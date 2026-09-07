-- =====================================================================
-- PHASE 2: Payroll -> Project allocation (captured per payslip).
--
-- SAFETY:
--  * Additive only. Does NOT modify payslips or transactions tables.
--  * One or more allocation rows per payslip; percentages should total 100.
--  * Effective-date splitting on transfers is handled in app logic by
--    seeding allocations from the employee's open assignment(s).
-- =====================================================================

CREATE TABLE IF NOT EXISTS payslip_project_allocations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  payslip_id uuid NOT NULL REFERENCES payslips(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  allocation_pct numeric NOT NULL DEFAULT 100 CHECK (allocation_pct >= 0 AND allocation_pct <= 100),
  source text NOT NULL DEFAULT 'auto',   -- 'auto' (seeded) | 'manual'
  UNIQUE (payslip_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_ppa_payslip ON payslip_project_allocations(payslip_id);
CREATE INDEX IF NOT EXISTS idx_ppa_project ON payslip_project_allocations(project_id);

ALTER TABLE payslip_project_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated" ON payslip_project_allocations;
CREATE POLICY "Allow all authenticated" ON payslip_project_allocations
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Helper view: allocation totals per payslip (to validate = 100 in app/reports)
CREATE OR REPLACE VIEW payslip_allocation_totals AS
  SELECT payslip_id, ROUND(SUM(allocation_pct), 2) AS total_pct, COUNT(*) AS project_count
  FROM payslip_project_allocations
  GROUP BY payslip_id;
