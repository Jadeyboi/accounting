-- =====================================================================
-- Backfill payslip project allocations.
--
-- For every payslip that has NO allocation row yet, create a single 100%
-- allocation to the employee's currently-assigned project
-- (employees.current_project_id).
--
-- SAFE:
--  * Only inserts where an allocation is missing (won't touch existing splits).
--  * Skips payslips whose employee has no assigned project (nothing to post to).
--  * Idempotent: re-running does nothing once allocations exist.
--
-- After running this, go to Project P&L → select the month → click "Sync Payroll".
-- =====================================================================

INSERT INTO payslip_project_allocations (payslip_id, project_id, allocation_pct, source)
SELECT p.id, e.current_project_id, 100, 'auto'
FROM payslips p
JOIN employees e ON e.id = p.employee_id
WHERE e.current_project_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM payslip_project_allocations a WHERE a.payslip_id = p.id
  );

-- Report what remains unallocated (employees with no project assigned)
-- Review these; assign them a project in HRIS if they should be costed.
SELECT p.id AS payslip_id, e.name AS employee, e.current_project_id
FROM payslips p
JOIN employees e ON e.id = p.employee_id
WHERE e.current_project_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM payslip_project_allocations a WHERE a.payslip_id = p.id);
