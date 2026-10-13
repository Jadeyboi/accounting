-- ============================================================
-- remove-13th-month-savings.sql
-- ============================================================
-- Removes the automatic 13th Month Pay SAVINGS reserve rows (source =
-- 'payroll_13th') from the savings table. Run manually in the Supabase SQL
-- editor, STEP BY STEP, after confirming you are in the intended project.
--
-- SCOPE / SAFETY:
--   * Affects ONLY savings rows with source = 'payroll_13th'.
--   * Does NOT touch payroll expenses, the cash balance, payslips, or other
--     savings categories (government contributions, HMO, manual savings).
--   * The 13th-month reserve is company-funded and was never posted as a
--     transaction/expense, so removing it does not change the cash balance.
--   * STEP 2 backs up every row BEFORE deletion so it can be restored.
--
-- CONFIRM THE PROJECT FIRST (production ref: blgvfnhpnieqzcyfgtnn). On the
-- production dataset referenced when this script was prepared, the counts were:
--   savings_rows=617, t13_rows=510, t13_total=1,381,250.13, tx_rows=965
-- Expect ~510 rows / ~1,381,250.13 total to be removed, leaving ~107 savings.
-- ============================================================

-- STEP 0 — sanity counts (read-only). Verify this looks like the right project.
SELECT
  (SELECT count(*) FROM savings)                                           AS savings_rows,
  (SELECT count(*) FROM savings WHERE source='payroll_13th')               AS t13_rows,
  (SELECT COALESCE(SUM(amount),0) FROM savings WHERE source='payroll_13th') AS t13_total,
  (SELECT count(*) FROM transactions)                                      AS tx_rows;

-- STEP 1 — PREVIEW the exact rows that will be deleted (read-only).
SELECT id, date, amount, description, status, payslip_id
FROM savings
WHERE source = 'payroll_13th'
ORDER BY date;

-- STEP 2 — BACKUP first (so the delete is reversible).
CREATE TABLE IF NOT EXISTS savings_backup_13th_removed AS
SELECT *, now() AS backed_up_at
FROM savings
WHERE source = 'payroll_13th';

-- STEP 3 — Confirm the backup captured everything (expect it to equal t13_rows).
SELECT count(*) AS backed_up_rows FROM savings_backup_13th_removed;

-- STEP 4 — DELETE the 13th-month savings rows.
--          Only run after STEP 3 matches the expected count.
DELETE FROM savings
WHERE source = 'payroll_13th';

-- STEP 5 — VERIFY removal (expect 0).
SELECT count(*) AS remaining_t13 FROM savings WHERE source = 'payroll_13th';

-- ============================================================
-- RESTORE (only if you need to undo). Reinsert the backed-up rows. Adjust the
-- column list to match your actual savings columns (see STEP 1 output).
--
--   INSERT INTO savings (id, created_at, date, description, amount, account,
--                        status, payslip_id, source, notes)
--   SELECT id, created_at, date, description, amount, account,
--          status, payslip_id, source, notes
--   FROM savings_backup_13th_removed;
--
-- When you are confident the removal is correct, drop the backup table:
--   DROP TABLE savings_backup_13th_removed;
-- ============================================================
