-- Oakridge billing records
CREATE TABLE IF NOT EXISTS oakridge_billings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  billing_month text NOT NULL, -- e.g. "2025-05"
  category text NOT NULL CHECK (category IN ('rent', 'cusa', 'electricity', 'water', 'internet', 'other')),
  description text,
  amount_due numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  due_date date,
  payment_date date,
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('paid', 'partial', 'unpaid', 'overdue')),
  billing_statement_url text,  -- uploaded billing PDF/image
  receipt_url text,            -- uploaded payment receipt
  notes text
);

ALTER TABLE oakridge_billings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON oakridge_billings
  FOR ALL USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_oakridge_billings_month ON oakridge_billings(billing_month DESC);
CREATE INDEX IF NOT EXISTS idx_oakridge_billings_status ON oakridge_billings(status);

-- Storage policies for oakridge-docs bucket (create the bucket manually in Supabase dashboard as private)
CREATE POLICY "Allow authenticated to upload oakridge docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'oakridge-docs');

CREATE POLICY "Allow authenticated to read oakridge docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'oakridge-docs');

CREATE POLICY "Allow authenticated to delete oakridge docs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'oakridge-docs');
