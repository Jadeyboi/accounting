-- Fix existing money_received table schema
-- Run this in Supabase SQL Editor

-- First, check what columns exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'money_received'
ORDER BY ordinal_position;

-- Add missing USD columns if they don't exist
ALTER TABLE public.money_received 
ADD COLUMN IF NOT EXISTS amount_usd DECIMAL(12,2);

ALTER TABLE public.money_received 
ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(8,4);

ALTER TABLE public.money_received 
ADD COLUMN IF NOT EXISTS amount_php DECIMAL(12,2);

-- Set default values for new columns
UPDATE public.money_received 
SET 
  amount_usd = COALESCE(amount / 56.0, 100),
  exchange_rate = 56.0,
  amount_php = COALESCE(amount, 5600)
WHERE amount_usd IS NULL;

-- Make the old amount column nullable (remove NOT NULL constraint)
ALTER TABLE public.money_received 
ALTER COLUMN amount DROP NOT NULL;

-- Make new columns NOT NULL after setting values
ALTER TABLE public.money_received 
ALTER COLUMN amount_usd SET NOT NULL;

ALTER TABLE public.money_received 
ALTER COLUMN exchange_rate SET NOT NULL;

ALTER TABLE public.money_received 
ALTER COLUMN amount_php SET NOT NULL;

-- Verify the final structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'money_received'
ORDER BY ordinal_position;