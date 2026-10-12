-- =============================================================================
-- add-payslip-uses-net-expense.sql
-- =============================================================================
-- Adds an explicit, durable flag that marks payslips created under the NEW
-- net-pay expense behavior. The linked payroll expense transaction uses NET pay
-- (actual cash disbursed) only for payslips where this flag is true.
--
-- WHY A COLUMN (not inferred from amounts):
--   The app must distinguish payslips created under the new behavior from
--   pre-existing ones WITHOUT inspecting whether a transaction equals gross or
--   net. This flag is the authoritative marker.
--
-- WHY DEFAULT false (no backfill, existing rows untouched):
--   Every existing payslip gets the column default of false, so it keeps the
--   original GROSS-based expense behavior — including when edited later. No
--   existing row's value is set/backfilled/recalculated. In PostgreSQL,
--   ADD COLUMN ... DEFAULT false is a metadata-only operation; it does not
--   rewrite or individually mark existing rows.
--
-- Idempotent and safe to re-run. Run in the Supabase SQL editor (STAGING).
-- The app sets uses_net_expense = true only on payslips it newly creates, so
-- this column MUST exist before generating a new payslip under the new code.
-- =============================================================================

ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS uses_net_expense boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.payslips.uses_net_expense IS
  'When true, the linked Payroll expense transaction reflects NET pay (actual cash disbursed). Payslips created before this behavior are false and retain GROSS-based expense, even when edited. Set true only on payslips created under the new behavior; never backfilled.';

-- Verify (read-only):
-- SELECT column_name, data_type, column_default, is_nullable
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'payslips'
--    AND column_name = 'uses_net_expense';
