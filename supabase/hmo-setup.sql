-- ============================================================
-- HMO Calculator & Payment Tracker
-- Connected to Employee Records, Payroll, Payslips, and Savings.
-- Run this in the Supabase SQL editor.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Payslip: HMO deduction line (employee-paid additional dependents)
-- ------------------------------------------------------------
ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS hmo_deduction numeric(12,2) DEFAULT 0;

-- ------------------------------------------------------------
-- 1. Enrollments — one active record per employee (principal)
--    Historical records are preserved via status + effective dates.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hmo_enrollments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  employee_id     uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  provider        text NOT NULL,
  plan            text,
  principal_premium numeric(12,2) NOT NULL DEFAULT 0 CHECK (principal_premium >= 0),
  -- how the provider bills the premium above: 'monthly' | 'quarterly' | 'annual'
  billing_cycle   text NOT NULL DEFAULT 'annual',
  coverage_start  date,
  coverage_end    date,
  effective_date  date NOT NULL DEFAULT current_date,
  -- proration rule applied to mid-period enrollment/changes:
  -- 'none' | 'daily' | 'monthly'
  proration       text NOT NULL DEFAULT 'none',
  status          text NOT NULL DEFAULT 'active',   -- 'active' | 'ended'
  notes           text
);

CREATE INDEX IF NOT EXISTS hmo_enrollments_employee_idx ON public.hmo_enrollments(employee_id, status);

-- ------------------------------------------------------------
-- 2. Dependents — company covers exactly one; others are employee-paid
--    coverage_type: 'company' (the one free dependent) | 'employee' (additional)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hmo_dependents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  enrollment_id   uuid NOT NULL REFERENCES public.hmo_enrollments(id) ON DELETE CASCADE,
  name            text NOT NULL,
  relationship    text,
  premium         numeric(12,2) NOT NULL DEFAULT 0 CHECK (premium >= 0),
  billing_cycle   text NOT NULL DEFAULT 'annual',    -- 'monthly' | 'quarterly' | 'annual'
  coverage_type   text NOT NULL DEFAULT 'employee',  -- 'company' | 'employee'
  coverage_start  date,
  coverage_end    date,
  effective_date  date NOT NULL DEFAULT current_date,
  status          text NOT NULL DEFAULT 'active',     -- 'active' | 'ended'
  notes           text
);

CREATE INDEX IF NOT EXISTS hmo_dependents_enrollment_idx ON public.hmo_dependents(enrollment_id, status);

-- Only ONE company-covered dependent per enrollment (the free dependent).
CREATE UNIQUE INDEX IF NOT EXISTS hmo_one_company_dependent_uidx
  ON public.hmo_dependents(enrollment_id)
  WHERE coverage_type = 'company' AND status = 'active';

-- ------------------------------------------------------------
-- 3. Savings linkage — reuse the savings table, new sources
--    (the govt-contributions migration already added payslip_id/source/notes)
-- ------------------------------------------------------------
ALTER TABLE public.savings
  ADD COLUMN IF NOT EXISTS payslip_id  uuid REFERENCES public.payslips(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS source      text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS notes       jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS savings_payslip_source_uidx
  ON public.savings(payslip_id, source)
  WHERE payslip_id IS NOT NULL;

-- ------------------------------------------------------------
-- 4. HMO bills / invoices from the provider
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hmo_bills (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  provider        text NOT NULL,
  invoice_number  text,
  coverage_start  date,
  coverage_end    date,
  due_date        date,
  amount_due      numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount_due >= 0),
  notes           text
);

CREATE INDEX IF NOT EXISTS hmo_bills_due_idx ON public.hmo_bills(due_date);

-- ------------------------------------------------------------
-- 5. HMO remittances / payments (Mark as Paid) — reduce HMO savings balance
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hmo_remittances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  bill_id         uuid REFERENCES public.hmo_bills(id) ON DELETE SET NULL,
  provider        text,
  coverage_period text,            -- free text label e.g. "2026-Q1" or "2026-01"
  paid_date       date NOT NULL,
  amount          numeric(12,2) NOT NULL CHECK (amount > 0),
  reference       text,
  notes           text
);

CREATE INDEX IF NOT EXISTS hmo_remittances_bill_idx ON public.hmo_remittances(bill_id);

-- ------------------------------------------------------------
-- 6. RLS — permissive, matching the rest of the schema
-- ------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['hmo_enrollments','hmo_dependents','hmo_bills','hmo_remittances'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Enable all operations for %1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "Enable all operations for %1$s" ON public.%1$I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END$$;
