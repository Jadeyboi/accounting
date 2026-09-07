-- =====================================================================
-- Link Money Received to Projects + P&L (integration, backward compatible).
--
-- SAFETY: additive only. Existing money_received records/columns preserved.
--  * Adds project_id (optional) and reporting_month (defaults from date_received).
--  * Backfills reporting_month for existing rows.
--  * A trigger keeps the linked project_transactions revenue row in sync so
--    approved Money Received appears in the Project P&L automatically —
--    without double counting (Overall P&L already reads the transactions ledger).
-- Run in Supabase SQL editor.
-- =====================================================================

ALTER TABLE public.money_received ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE public.money_received ADD COLUMN IF NOT EXISTS reporting_month text;
ALTER TABLE public.money_received ADD COLUMN IF NOT EXISTS project_txn_id uuid REFERENCES project_transactions(id) ON DELETE SET NULL;

-- Backfill reporting_month from date_received where missing
UPDATE public.money_received
  SET reporting_month = to_char(date_received, 'YYYY-MM')
  WHERE reporting_month IS NULL;

CREATE INDEX IF NOT EXISTS money_received_project_idx ON public.money_received(project_id);
CREATE INDEX IF NOT EXISTS money_received_month_idx ON public.money_received(reporting_month);

-- ---------------------------------------------------------------------
-- Sync approved Money Received -> project_transactions (revenue).
-- "Approved" = status IN ('confirmed','cleared'). pending/cancelled excluded.
-- Idempotent: one revenue row per money_received (tracked by project_txn_id).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_money_received_to_project()
RETURNS trigger AS $$
DECLARE
  v_month text;
  v_counts boolean;
  v_proj_status text;
BEGIN
  v_month := COALESCE(NEW.reporting_month, to_char(NEW.date_received, 'YYYY-MM'));
  v_counts := (NEW.status IN ('confirmed', 'cleared')) AND NEW.project_id IS NOT NULL;

  -- If project archived/closed, do not post
  IF NEW.project_id IS NOT NULL THEN
    SELECT status INTO v_proj_status FROM projects WHERE id = NEW.project_id;
    IF v_proj_status IN ('completed', 'cancelled') THEN v_counts := false; END IF;
  END IF;

  IF v_counts THEN
    IF NEW.project_txn_id IS NULL THEN
      INSERT INTO project_transactions
        (project_id, kind, category, description, txn_date, month, currency, exchange_rate,
         amount, amount_php, invoice_ref, status, source, created_by, approved_by, approved_at)
      VALUES
        (NEW.project_id, 'revenue', COALESCE(NEW.category, 'Client Payment'),
         COALESCE(NEW.purpose, 'Money received') || ' — ' || COALESCE(NEW.sender_name, ''),
         NEW.date_received, v_month, 'USD', NEW.exchange_rate,
         NEW.amount_usd, NEW.amount_php, NEW.reference_number, 'approved', 'money_received',
         'money_received', 'money_received', now())
      RETURNING id INTO NEW.project_txn_id;
    ELSE
      UPDATE project_transactions SET
        project_id = NEW.project_id, category = COALESCE(NEW.category, 'Client Payment'),
        description = COALESCE(NEW.purpose, 'Money received') || ' — ' || COALESCE(NEW.sender_name, ''),
        txn_date = NEW.date_received, month = v_month, currency = 'USD', exchange_rate = NEW.exchange_rate,
        amount = NEW.amount_usd, amount_php = NEW.amount_php, invoice_ref = NEW.reference_number, status = 'approved'
      WHERE id = NEW.project_txn_id;
    END IF;
  ELSE
    -- no longer counts (cancelled/pending/project removed) -> remove linked revenue if any
    IF NEW.project_txn_id IS NOT NULL THEN
      DELETE FROM project_transactions WHERE id = NEW.project_txn_id;
      NEW.project_txn_id := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Allow 'money_received' as a project_transactions source (documentation; column is free text)
-- BEFORE trigger so we can set NEW.project_txn_id inline.
DROP TRIGGER IF EXISTS trg_money_received_sync ON public.money_received;
CREATE TRIGGER trg_money_received_sync
  BEFORE INSERT OR UPDATE ON public.money_received
  FOR EACH ROW EXECUTE FUNCTION sync_money_received_to_project();

-- Clean up the linked project revenue row when a money_received record is deleted
CREATE OR REPLACE FUNCTION cleanup_money_received_project_txn()
RETURNS trigger AS $$
BEGIN
  IF OLD.project_txn_id IS NOT NULL THEN
    DELETE FROM project_transactions WHERE id = OLD.project_txn_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_money_received_cleanup ON public.money_received;
CREATE TRIGGER trg_money_received_cleanup
  AFTER DELETE ON public.money_received
  FOR EACH ROW EXECUTE FUNCTION cleanup_money_received_project_txn();

-- Backfill: create project revenue rows for existing approved+project-linked records
UPDATE public.money_received SET reporting_month = reporting_month WHERE project_id IS NOT NULL AND status IN ('confirmed','cleared') AND project_txn_id IS NULL;
