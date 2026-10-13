-- ============================================================
-- remove-13th-month-payments.sql
-- ============================================================
-- Removes 13th Month Pay PAYMENT records from thirteenth_month_payments.
-- These are actual disbursement records (the "PAID" figure in the 13th Month
-- Pay panel) — a DIFFERENT table from savings. The savings reserves were
-- removed separately by remove-13th-month-savings.sql; this clears the leftover
-- payment record (e.g. the PHP 2,583.33 "Unknown / 2026" row seen in the UI).
--
-- SCOPE / SAFETY:
--   * Affects ONLY the thirteenth_month_payments table.
--   * Does NOT touch savings, payroll expenses, the cash balance, payslips, or
--     any transaction. The panel's "Available Balance" (Reserved - Paid) is
--     that panel's own math, not the company cash balance (dashboard
--     PHP 895,139.09 is unaffected).
--   * STEP 2 backs up every row BEFORE deletion so it can be restored.
--
-- Run manually in the Supabase SQL editor, STEP BY STEP, in the PRODUCTION
-- project (ref blgvfnhpnieqzcyfgtnn). Confirm STEP 0 shows the expected row(s)
-- before deleting.
-- ============================================================

-- STEP 0 — PREVIEW the 13th-month payment record(s) (read-only).
--          Expect the single PHP 2,583.33 row (employee shows as "Unknown",
--          year 2026) per the UI. Note the id / employee_id here.
SELECT id, employee_id, year, paid_date, amount, reference, is_final_pay, notes
FROM thirteenth_month_payments
ORDER BY paid_date;

-- STEP 1 — COUNT + TOTAL (read-only sanity check). Expect 1 row / 2583.33.
SELECT count(*) AS rows, COALESCE(SUM(amount),0) AS total
FROM thirteenth_month_payments;

-- STEP 2 — BACKUP first (so the delete is reversible).
CREATE TABLE IF NOT EXISTS thirteenth_month_payments_backup_removed AS
SELECT *, now() AS backed_up_at
FROM thirteenth_month_payments;

-- STEP 3 — Confirm the backup captured everything (should equal STEP 1 rows).
SELECT count(*) AS backed_up_rows FROM thirteenth_month_payments_backup_removed;

-- STEP 4 — DELETE.
--   Option A (recommended if there is exactly one row and it is the stale
--   "Unknown" PHP 2,583.33 record): delete by id for maximum safety.
--     DELETE FROM thirteenth_month_payments WHERE id = '<id from STEP 0>';
--
--   Option B: delete all 13th-month payment records (use only if you intend to
--   clear the entire table).
DELETE FROM thirteenth_month_payments;

-- STEP 5 — VERIFY removal (expect 0, or the remaining legitimate rows if you
--          used the by-id Option A).
SELECT count(*) AS remaining FROM thirteenth_month_payments;

-- ============================================================
-- RESTORE (only if you need to undo). Reinsert the backed-up rows. Adjust the
-- column list to match your actual table columns (see STEP 0 output).
--
--   INSERT INTO thirteenth_month_payments
--     (id, created_at, employee_id, year, paid_date, amount, reference,
--      is_final_pay, notes)
--   SELECT id, created_at, employee_id, year, paid_date, amount, reference,
--          is_final_pay, notes
--   FROM thirteenth_month_payments_backup_removed;
--
-- When confident, drop the backup table:
--   DROP TABLE thirteenth_month_payments_backup_removed;
-- ============================================================
