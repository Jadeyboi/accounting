-- Test script to manually insert a fund request history record
-- Use this to test if the database setup is working

-- First, make sure tables exist
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

-- Enable RLS and create policy
ALTER TABLE public.fund_request_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all operations for fund_request_history" ON public.fund_request_history;
CREATE POLICY "Enable all operations for fund_request_history" ON public.fund_request_history
  FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fund_request_history TO anon, authenticated;

-- Insert a test record
INSERT INTO public.fund_request_history (
  period,
  period_label,
  items,
  total_monthly,
  total_half_month,
  total_one_time,
  total_amount,
  usd_rate,
  notes
) VALUES (
  '2024-01',
  'January 2024',
  '[{"id":"test-1","description":"Test Item","amount":1000,"requestType":"whole_month","monthlyAmount":1000,"halfMonthAmount":0,"remarks":"Test","status":"N/A"}]'::jsonb,
  1000.00,
  0.00,
  0.00,
  1000.00,
  56.0,
  'Test record for debugging'
);

-- Verify the record was inserted
SELECT 
  'Test record inserted:' as info,
  id,
  period,
  period_label,
  total_amount,
  created_at
FROM public.fund_request_history 
WHERE period = '2024-01';

-- Check if we can query it (this is what the app does)
SELECT 
  'App query test:' as info,
  COUNT(*) as total_records
FROM public.fund_request_history;