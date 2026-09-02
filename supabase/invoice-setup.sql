-- Invoice module persistence: saved clients, saved descriptions, and saved invoices.
-- Run this in the Supabase SQL editor. Data will then persist across refreshes,
-- pages, browsers, and devices (previously it was stored only in localStorage).

-- ── Saved clients ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Saved descriptions (reusable line-item templates) ────────────────────────
CREATE TABLE IF NOT EXISTS invoice_descriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Saved invoices (history) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT,
  invoice_date DATE,
  due_date DATE,
  client_name TEXT,
  client_email TEXT,
  client_address TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  terms TEXT,
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  tax DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid', -- 'unpaid' | 'paid'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- If the invoices table already exists from an earlier setup, add the status column
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'unpaid';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_clients_name ON invoice_clients(name);

-- Enable RLS
ALTER TABLE invoice_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Policies (allow all operations for authenticated users, matching other tables)
DROP POLICY IF EXISTS "Enable all operations for invoice_clients" ON invoice_clients;
CREATE POLICY "Enable all operations for invoice_clients" ON invoice_clients
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all operations for invoice_descriptions" ON invoice_descriptions;
CREATE POLICY "Enable all operations for invoice_descriptions" ON invoice_descriptions
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all operations for invoices" ON invoices;
CREATE POLICY "Enable all operations for invoices" ON invoices
  FOR ALL USING (true) WITH CHECK (true);
