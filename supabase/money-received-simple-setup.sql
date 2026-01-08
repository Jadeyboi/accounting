-- Simple Money Received Setup - No Syntax Errors
-- Run this in Supabase SQL Editor

-- Create money_received table
CREATE TABLE IF NOT EXISTS public.money_received (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date_received DATE NOT NULL,
  amount_usd DECIMAL(12,2) NOT NULL,
  exchange_rate DECIMAL(8,4) NOT NULL,
  amount_php DECIMAL(12,2) NOT NULL,
  sender_name TEXT NOT NULL,
  sender_contact TEXT,
  payment_method TEXT NOT NULL,
  reference_number TEXT,
  purpose TEXT NOT NULL,
  category TEXT,
  notes TEXT,
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add constraints
ALTER TABLE public.money_received 
ADD CONSTRAINT IF NOT EXISTS money_received_amount_usd_positive CHECK (amount_usd > 0);

ALTER TABLE public.money_received 
ADD CONSTRAINT IF NOT EXISTS money_received_exchange_rate_positive CHECK (exchange_rate > 0);

ALTER TABLE public.money_received 
ADD CONSTRAINT IF NOT EXISTS money_received_amount_php_positive CHECK (amount_php > 0);

ALTER TABLE public.money_received 
ADD CONSTRAINT IF NOT EXISTS money_received_payment_method_check 
CHECK (payment_method IN ('bank_transfer', 'cash', 'check', 'gcash', 'paymaya', 'paypal', 'other'));

ALTER TABLE public.money_received 
ADD CONSTRAINT IF NOT EXISTS money_received_status_check 
CHECK (status IN ('pending', 'confirmed', 'cleared'));

-- Add indexes
CREATE INDEX IF NOT EXISTS money_received_date_idx ON public.money_received(date_received);
CREATE INDEX IF NOT EXISTS money_received_status_idx ON public.money_received(status);
CREATE INDEX IF NOT EXISTS money_received_payment_method_idx ON public.money_received(payment_method);
CREATE INDEX IF NOT EXISTS money_received_sender_idx ON public.money_received(sender_name);
CREATE INDEX IF NOT EXISTS money_received_amount_usd_idx ON public.money_received(amount_usd);
CREATE INDEX IF NOT EXISTS money_received_amount_php_idx ON public.money_received(amount_php);

-- Enable Row Level Security
ALTER TABLE public.money_received ENABLE ROW LEVEL SECURITY;

-- Create policy
DROP POLICY IF EXISTS "Enable all operations for money_received" ON public.money_received;
CREATE POLICY "Enable all operations for money_received" ON public.money_received
  FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.money_received TO anon, authenticated;