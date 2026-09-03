-- Simplified Profit & Loss module
-- Two flat tables: income and expenses, one row per line item per month.
-- Run this in your Supabase SQL editor.

-- Income line items
CREATE TABLE IF NOT EXISTS pl_income (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  month text NOT NULL,            -- YYYY-MM
  description text NOT NULL,
  client text,                    -- optional client/label
  project text,                   -- optional project name (for per-project view)
  amount numeric NOT NULL DEFAULT 0
);

-- If pl_income already exists from an earlier setup, add the project column
ALTER TABLE pl_income ADD COLUMN IF NOT EXISTS project text;

-- Expense line items
CREATE TABLE IF NOT EXISTS pl_expenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  month text NOT NULL,            -- YYYY-MM
  category text NOT NULL DEFAULT 'Other',
  description text,
  project text,                   -- optional project name (for per-project allocation)
  amount numeric NOT NULL DEFAULT 0
);

-- If pl_expenses already exists from an earlier setup, add the project column
ALTER TABLE pl_expenses ADD COLUMN IF NOT EXISTS project text;

-- Indexes for month filtering
CREATE INDEX IF NOT EXISTS idx_pl_income_month ON pl_income(month);
CREATE INDEX IF NOT EXISTS idx_pl_expenses_month ON pl_expenses(month);

-- Row Level Security
ALTER TABLE pl_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE pl_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated" ON pl_income;
CREATE POLICY "Allow all authenticated" ON pl_income
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow all authenticated" ON pl_expenses;
CREATE POLICY "Allow all authenticated" ON pl_expenses
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
