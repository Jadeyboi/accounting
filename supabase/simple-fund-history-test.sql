-- Simple test to check if fund request history is working
-- Run this step by step

-- Step 1: Check if table exists
SELECT 'Checking if fund_request_history table exists...' as step;
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'fund_request_history'
) as table_exists;

-- Step 2: Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.fund_request_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  period TEXT NOT NULL,
  period_label TEXT NOT NULL,
  items JSONB NOT NULL,
  total_monthly DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_half_month DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_one_time DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  usd_rate DECIMAL(8,4) NOT NULL DEFAULT 56.0,
  notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Set up RLS and permissions
ALTER TABLE public.fund_request_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all operations for fund_request_history" ON public.fund_request_history;
CREATE POLICY "Enable all operations for fund_request_history" ON public.fund_request_history
  FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fund_request_history TO anon, authenticated;

-- Step 4: Insert a simple test record
DELETE FROM public.fund_request_history WHERE period = 'TEST-2024';
INSERT INTO public.fund_request_history (
  period,
  period_label,
  items,
  total_monthly,
  total_amount,
  usd_rate
) VALUES (
  'TEST-2024',
  'Test Record 2024',
  '[{"id":"1","description":"Test Item","amount":1000}]'::jsonb,
  1000.00,
  1000.00,
  56.0
);

-- Step 5: Verify we can read it back
SELECT 'Test record verification:' as step;
SELECT 
  id,
  period,
  period_label,
  total_amount,
  created_at
FROM public.fund_request_history 
WHERE period = 'TEST-2024';

-- Step 6: Count all records
SELECT 'Total records in table:' as step;
SELECT COUNT(*) as total_records FROM public.fund_request_history;