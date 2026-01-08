-- Final Money Received Setup - Handles Existing Objects
-- Run this in Supabase SQL Editor

-- Create money_received table (skip if exists)
CREATE TABLE IF NOT EXISTS public.money_received (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date_received DATE NOT NULL,
  amount_usd DECIMAL(12,2) NOT NULL CHECK (amount_usd > 0),
  exchange_rate DECIMAL(8,4) NOT NULL CHECK (exchange_rate > 0),
  amount_php DECIMAL(12,2) NOT NULL CHECK (amount_php > 0),
  sender_name TEXT NOT NULL,
  sender_contact TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('bank_transfer', 'cash', 'check', 'gcash', 'paymaya', 'paypal', 'other')),
  reference_number TEXT,
  purpose TEXT NOT NULL,
  category TEXT,
  notes TEXT,
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cleared')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes (skip if exist)
CREATE INDEX IF NOT EXISTS money_received_date_idx ON public.money_received(date_received);
CREATE INDEX IF NOT EXISTS money_received_status_idx ON public.money_received(status);
CREATE INDEX IF NOT EXISTS money_received_sender_idx ON public.money_received(sender_name);

-- Enable Row Level Security
ALTER TABLE public.money_received ENABLE ROW LEVEL SECURITY;

-- Drop existing policy and recreate
DROP POLICY IF EXISTS "Enable all operations for money_received" ON public.money_received;
CREATE POLICY "Enable all operations for money_received" ON public.money_received
  FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.money_received TO anon, authenticated;

-- Check if table was created successfully
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'money_received'
ORDER BY ordinal_position;