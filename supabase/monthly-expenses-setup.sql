-- Monthly Expenses tracker: recurring bills (rent, CUSA, internet, etc.)
-- with per-month paid/unpaid status. Run in Supabase SQL editor.

-- Recurring expense items (the checklist of bills to pay each month)
CREATE TABLE IF NOT EXISTS monthly_expense_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  name text NOT NULL,                    -- e.g. Rent, CUSA, Internet
  category text,                         -- optional grouping
  default_amount numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0
);

-- Per-month payment status for each item
CREATE TABLE IF NOT EXISTS monthly_expense_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  item_id uuid NOT NULL REFERENCES monthly_expense_items(id) ON DELETE CASCADE,
  month text NOT NULL,                   -- YYYY-MM
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'paid',   -- recorded when paid
  paid_date date,
  notes text,
  UNIQUE (item_id, month)
);

CREATE INDEX IF NOT EXISTS idx_mei_active ON monthly_expense_items(active);
CREATE INDEX IF NOT EXISTS idx_mep_item ON monthly_expense_payments(item_id);
CREATE INDEX IF NOT EXISTS idx_mep_month ON monthly_expense_payments(month);

ALTER TABLE monthly_expense_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_expense_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated" ON monthly_expense_items;
CREATE POLICY "Allow all authenticated" ON monthly_expense_items
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow all authenticated" ON monthly_expense_payments;
CREATE POLICY "Allow all authenticated" ON monthly_expense_payments
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
