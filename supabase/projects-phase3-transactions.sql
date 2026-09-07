-- =====================================================================
-- PHASE 3: Project financial transactions + shared-expense allocation
-- + private attachments bucket.
--
-- SAFETY: additive only. Does not touch existing finance tables.
-- Only 'approved' transactions affect P&L totals (enforced in app + views).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Project transactions (revenue / expense / liability / adjustment)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,

  kind text NOT NULL,                     -- 'revenue' | 'expense' | 'liability' | 'adjustment'
  category text,                          -- e.g. Client Billing, Software, Rent, Employer SSS, ...
  description text,
  txn_date date NOT NULL DEFAULT CURRENT_DATE,
  month text NOT NULL,                    -- YYYY-MM reporting month

  currency text NOT NULL DEFAULT 'PHP',
  exchange_rate numeric NOT NULL DEFAULT 1,  -- units of PHP per 1 currency unit
  amount numeric NOT NULL DEFAULT 0,         -- amount in `currency`
  amount_php numeric NOT NULL DEFAULT 0,     -- PHP-converted (amount * exchange_rate)

  invoice_ref text,
  attachment_path text,                   -- storage path in 'project-files' bucket
  status text NOT NULL DEFAULT 'draft',   -- draft | approved | paid | cancelled
  due_date date,
  payment_date date,

  -- provenance & linkage
  source text NOT NULL DEFAULT 'manual',  -- 'manual' | 'auto_payroll'
  payslip_id uuid REFERENCES payslips(id) ON DELETE SET NULL,      -- for auto payroll allocation (Phase 4)
  shared_expense_id uuid,                 -- set if generated from a shared expense allocation

  created_by text,
  approved_by text,
  approved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ptx_project ON project_transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_ptx_month ON project_transactions(month);
CREATE INDEX IF NOT EXISTS idx_ptx_status ON project_transactions(status);
CREATE INDEX IF NOT EXISTS idx_ptx_kind ON project_transactions(kind);
CREATE INDEX IF NOT EXISTS idx_ptx_payslip ON project_transactions(payslip_id);
-- prevent duplicate auto payroll rows for the same payslip+project+category+month
CREATE UNIQUE INDEX IF NOT EXISTS uq_ptx_auto_payroll
  ON project_transactions(payslip_id, project_id, category, month)
  WHERE source = 'auto_payroll';

CREATE OR REPLACE FUNCTION set_ptx_updated_at()
RETURNS trigger AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_ptx_updated ON project_transactions;
CREATE TRIGGER trg_ptx_updated BEFORE UPDATE ON project_transactions
  FOR EACH ROW EXECUTE FUNCTION set_ptx_updated_at();

-- ---------------------------------------------------------------------
-- 2. Audit trail for project transactions
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_transaction_audit (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  transaction_id uuid REFERENCES project_transactions(id) ON DELETE CASCADE,
  action text NOT NULL,           -- created | updated | status_change | deleted
  actor text,
  reason text,
  old_amount_php numeric,
  new_amount_php numeric,
  detail jsonb
);
CREATE INDEX IF NOT EXISTS idx_ptx_audit_txn ON project_transaction_audit(transaction_id);

-- ---------------------------------------------------------------------
-- 3. Shared expenses (allocated across multiple projects)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shared_expenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  description text NOT NULL,
  category text,
  month text NOT NULL,                    -- YYYY-MM
  currency text NOT NULL DEFAULT 'PHP',
  exchange_rate numeric NOT NULL DEFAULT 1,
  amount numeric NOT NULL DEFAULT 0,
  amount_php numeric NOT NULL DEFAULT 0,
  allocation_method text NOT NULL DEFAULT 'equal',  -- equal | headcount | revenue | custom
  status text NOT NULL DEFAULT 'draft',   -- draft | approved | cancelled
  notes text,
  created_by text,
  approved_by text,
  approved_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_shared_month ON shared_expenses(month);
CREATE INDEX IF NOT EXISTS idx_shared_status ON shared_expenses(status);

-- Per-project allocation lines for a shared expense
CREATE TABLE IF NOT EXISTS shared_expense_allocations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  shared_expense_id uuid NOT NULL REFERENCES shared_expenses(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  allocation_pct numeric NOT NULL DEFAULT 0,
  amount_php numeric NOT NULL DEFAULT 0,
  UNIQUE (shared_expense_id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_shared_alloc_shared ON shared_expense_allocations(shared_expense_id);
CREATE INDEX IF NOT EXISTS idx_shared_alloc_project ON shared_expense_allocations(project_id);

CREATE OR REPLACE FUNCTION set_shared_updated_at()
RETURNS trigger AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_shared_updated ON shared_expenses;
CREATE TRIGGER trg_shared_updated BEFORE UPDATE ON shared_expenses
  FOR EACH ROW EXECUTE FUNCTION set_shared_updated_at();

-- ---------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------
ALTER TABLE project_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_transaction_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_expense_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated" ON project_transactions;
CREATE POLICY "Allow all authenticated" ON project_transactions
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Allow all authenticated" ON project_transaction_audit;
CREATE POLICY "Allow all authenticated" ON project_transaction_audit
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Allow all authenticated" ON shared_expenses;
CREATE POLICY "Allow all authenticated" ON shared_expenses
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Allow all authenticated" ON shared_expense_allocations;
CREATE POLICY "Allow all authenticated" ON shared_expense_allocations
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------
-- 5. Private attachments bucket + storage policies
--    Only authenticated users can read/write project files.
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
  VALUES ('project-files', 'project-files', false)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "project-files auth read" ON storage.objects;
CREATE POLICY "project-files auth read" ON storage.objects
  FOR SELECT USING (bucket_id = 'project-files' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "project-files auth write" ON storage.objects;
CREATE POLICY "project-files auth write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'project-files' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "project-files auth update" ON storage.objects;
CREATE POLICY "project-files auth update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'project-files' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "project-files auth delete" ON storage.objects;
CREATE POLICY "project-files auth delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'project-files' AND auth.uid() IS NOT NULL);
