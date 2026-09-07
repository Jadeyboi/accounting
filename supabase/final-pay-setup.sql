-- Final Pay Computation for separated employees.
-- Integrates with existing employees / salary_history / leave balances / loans.
-- Stores an itemized snapshot + status workflow + versioning + audit trail.
-- Run in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS final_pay (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  -- version chain: revisions create a NEW row referencing the original
  version int NOT NULL DEFAULT 1,
  supersedes_id uuid REFERENCES final_pay(id) ON DELETE SET NULL,

  -- snapshot of key inputs at computation time (so later employee edits don't change an approved record)
  employee_name text,
  employee_number text,
  position text,
  department text,
  date_hired date,
  last_working_day date,
  separation_reason text NOT NULL,        -- enumerated key (see app), stored as text
  monthly_basic_salary numeric NOT NULL DEFAULT 0,
  payroll_divisor numeric NOT NULL DEFAULT 26,   -- configurable working-days divisor for daily rate
  credited_years numeric NOT NULL DEFAULT 0,

  -- computed components (all peso, 2dp at line level)
  unpaid_salary numeric NOT NULL DEFAULT 0,
  separation_pay numeric NOT NULL DEFAULT 0,
  separation_pay_applies boolean NOT NULL DEFAULT false,
  thirteenth_month numeric NOT NULL DEFAULT 0,
  thirteenth_month_already_paid numeric NOT NULL DEFAULT 0,
  leave_conversion numeric NOT NULL DEFAULT 0,

  -- free-form line items (earnings/deductions) + full computation breakdown
  -- shape: { earnings:[{desc,amount}], deductions:[{desc,amount}], breakdown:{...} }
  details jsonb NOT NULL DEFAULT '{}'::jsonb,

  gross_final_pay numeric NOT NULL DEFAULT 0,
  total_deductions numeric NOT NULL DEFAULT 0,
  net_final_pay numeric NOT NULL DEFAULT 0,

  status text NOT NULL DEFAULT 'draft',   -- draft | for_review | approved | paid | cancelled

  prepared_by text,
  reviewed_by text,
  approved_by text,
  approved_at timestamptz,
  paid_at timestamptz,

  notes text
);

CREATE INDEX IF NOT EXISTS idx_final_pay_employee ON final_pay(employee_id);
CREATE INDEX IF NOT EXISTS idx_final_pay_status ON final_pay(status);
CREATE INDEX IF NOT EXISTS idx_final_pay_supersedes ON final_pay(supersedes_id);

-- Audit trail of every change (immutable log)
CREATE TABLE IF NOT EXISTS final_pay_audit (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  final_pay_id uuid NOT NULL REFERENCES final_pay(id) ON DELETE CASCADE,
  action text NOT NULL,             -- created | updated | status_change | revised | approved | paid | cancelled
  actor text,                       -- user email
  from_status text,
  to_status text,
  snapshot jsonb                    -- optional snapshot of the record at this point
);

CREATE INDEX IF NOT EXISTS idx_final_pay_audit_fp ON final_pay_audit(final_pay_id);

-- keep updated_at fresh
CREATE OR REPLACE FUNCTION set_final_pay_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_final_pay_updated ON final_pay;
CREATE TRIGGER trg_final_pay_updated BEFORE UPDATE ON final_pay
  FOR EACH ROW EXECUTE FUNCTION set_final_pay_updated_at();

-- RLS
ALTER TABLE final_pay ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_pay_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated" ON final_pay;
CREATE POLICY "Allow all authenticated" ON final_pay
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow all authenticated" ON final_pay_audit;
CREATE POLICY "Allow all authenticated" ON final_pay_audit
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
