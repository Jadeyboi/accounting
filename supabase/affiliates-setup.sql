-- Affiliates module: monitor monthly commission payments per affiliate per project.
-- Run this in your Supabase SQL editor.

-- Fresh start: drop old affiliate tables if they exist (safe — no real data yet).
-- Order matters due to foreign keys; CASCADE handles dependents.
DROP TABLE IF EXISTS affiliate_payments CASCADE;
DROP TABLE IF EXISTS affiliate_commissions CASCADE;
DROP TABLE IF EXISTS affiliates CASCADE;

-- Affiliates
CREATE TABLE IF NOT EXISTS affiliates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  name text NOT NULL,
  contact text,                          -- email / phone (optional)
  status text NOT NULL DEFAULT 'active', -- 'active' | 'inactive'
  notes text
);

-- Commissions: an affiliate can have multiple project commissions
CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  affiliate_id uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  project text NOT NULL,                 -- project name
  monthly_amount numeric NOT NULL DEFAULT 0
);

-- Monthly payments per affiliate per project
CREATE TABLE IF NOT EXISTS affiliate_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  affiliate_id uuid NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  commission_id uuid REFERENCES affiliate_commissions(id) ON DELETE CASCADE,
  project text NOT NULL,
  month text NOT NULL,                   -- YYYY-MM
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'paid',   -- payments are recorded when paid
  paid_date date,
  notes text
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate ON affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_payments_affiliate ON affiliate_payments(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_payments_commission ON affiliate_payments(commission_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_payments_month ON affiliate_payments(month);
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON affiliates(status);

-- Row Level Security
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated" ON affiliates;
CREATE POLICY "Allow all authenticated" ON affiliates
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow all authenticated" ON affiliate_commissions;
CREATE POLICY "Allow all authenticated" ON affiliate_commissions
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow all authenticated" ON affiliate_payments;
CREATE POLICY "Allow all authenticated" ON affiliate_payments
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
