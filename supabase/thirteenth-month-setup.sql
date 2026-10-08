-- ============================================================
-- Automatic 13th Month Pay Savings
-- Connected to Payroll, Employee Records, and Savings.
-- Run this in the Supabase SQL editor.
--
-- Formula (per semi-monthly cutoff):
--   13th month accrual = eligible basic salary earned that period / 12
-- Basic salary earned = payslip.gross_salary (basic for the cutoff), which
-- already excludes bonuses/allowances/holiday pay and is NOT reduced by SSS,
-- Pag-IBIG, PhilHealth, tax, or HMO deductions.
-- ============================================================

-- 1. Savings linkage columns (idempotent; added by earlier migrations too).
ALTER TABLE public.savings
  ADD COLUMN IF NOT EXISTS payslip_id uuid REFERENCES public.payslips(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS source     text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS notes      jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS savings_payslip_source_uidx
  ON public.savings(payslip_id, source)
  WHERE payslip_id IS NOT NULL;

-- 2. 13th month payments ledger (actual disbursements to employees).
--    One calendar year is tracked via the `year` column.
CREATE TABLE IF NOT EXISTS public.thirteenth_month_payments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  employee_id  uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  year         integer NOT NULL,                 -- calendar year the payment applies to
  paid_date    date NOT NULL,
  amount       numeric(12,2) NOT NULL CHECK (amount > 0),
  reference    text,
  is_final_pay boolean NOT NULL DEFAULT false,   -- true when settled via Final Pay
  notes        text
);

CREATE INDEX IF NOT EXISTS t13_payments_emp_year_idx
  ON public.thirteenth_month_payments(employee_id, year);

-- 3. Optional: prior-reserve import rows (for midyear implementation).
--    These let you record reserves/accruals that existed before this feature
--    without re-deriving them from payslips. Linked to no payslip, so they are
--    never touched by the automatic per-payslip sync.
CREATE TABLE IF NOT EXISTS public.thirteenth_month_opening (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  year        integer NOT NULL,
  accrued     numeric(12,2) NOT NULL DEFAULT 0,  -- entitlement already earned before feature start
  reserved    numeric(12,2) NOT NULL DEFAULT 0,  -- funds already set aside before feature start
  paid        numeric(12,2) NOT NULL DEFAULT 0,  -- 13th month already paid before feature start
  notes       text
);

CREATE INDEX IF NOT EXISTS t13_opening_emp_year_idx
  ON public.thirteenth_month_opening(employee_id, year);

-- 4. RLS — permissive, matching the rest of the schema.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['thirteenth_month_payments','thirteenth_month_opening'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Enable all operations for %1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "Enable all operations for %1$s" ON public.%1$I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END$$;
