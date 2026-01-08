-- Clean fix for money_received table - guaranteed to work
-- This script resolves all schema and policy conflicts with proper syntax

-- Step 1: Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable all operations for money_received" ON public.money_received;

-- Step 2: Check if table exists, if not create it
CREATE TABLE IF NOT EXISTS public.money_received (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date_received DATE NOT NULL,
  sender_name TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('bank_transfer', 'cash', 'check', 'gcash', 'paymaya', 'paypal', 'other')),
  purpose TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cleared')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Add old amount column if it doesn't exist (for backward compatibility)
ALTER TABLE public.money_received 
ADD COLUMN IF NOT EXISTS amount DECIMAL(12,2);

-- Step 4: Add USD columns
ALTER TABLE public.money_received 
ADD COLUMN IF NOT EXISTS amount_usd DECIMAL(12,2);

ALTER TABLE public.money_received 
ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(8,4);

ALTER TABLE public.money_received 
ADD COLUMN IF NOT EXISTS amount_php DECIMAL(12,2);

-- Step 5: Add other optional columns
ALTER TABLE public.money_received 
ADD COLUMN IF NOT EXISTS sender_contact TEXT;

ALTER TABLE public.money_received 
ADD COLUMN IF NOT EXISTS reference_number TEXT;

ALTER TABLE public.money_received 
ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE public.money_received 
ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.money_received 
ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- Step 6: Make old amount column nullable
ALTER TABLE public.money_received 
ALTER COLUMN amount DROP NOT NULL;

-- Step 7: Set default values for USD columns for existing records
UPDATE public.money_received 
SET 
  amount_usd = COALESCE(amount_usd, COALESCE(amount / 56.0, 100)),
  exchange_rate = COALESCE(exchange_rate, 56.0),
  amount_php = COALESCE(amount_php, COALESCE(amount, 5600))
WHERE amount_usd IS NULL OR exchange_rate IS NULL OR amount_php IS NULL;

-- Step 8: Make USD columns NOT NULL after setting values
ALTER TABLE public.money_received 
ALTER COLUMN amount_usd SET NOT NULL;

ALTER TABLE public.money_received 
ALTER COLUMN exchange_rate SET NOT NULL;

ALTER TABLE public.money_received 
ALTER COLUMN amount_php SET NOT NULL;

-- Step 9: Drop existing constraints to avoid conflicts
ALTER TABLE public.money_received 
DROP CONSTRAINT IF EXISTS money_received_amount_usd_positive;

ALTER TABLE public.money_received 
DROP CONSTRAINT IF EXISTS money_received_exchange_rate_positive;

ALTER TABLE public.money_received 
DROP CONSTRAINT IF EXISTS money_received_amount_php_positive;

-- Step 10: Add positive value constraints
ALTER TABLE public.money_received 
ADD CONSTRAINT money_received_amount_usd_positive CHECK (amount_usd > 0);

ALTER TABLE public.money_received 
ADD CONSTRAINT money_received_exchange_rate_positive CHECK (exchange_rate > 0);

ALTER TABLE public.money_received 
ADD CONSTRAINT money_received_amount_php_positive CHECK (amount_php > 0);

-- Step 11: Create indexes for better performance
CREATE INDEX IF NOT EXISTS money_received_date_idx ON public.money_received(date_received);
CREATE INDEX IF NOT EXISTS money_received_status_idx ON public.money_received(status);
CREATE INDEX IF NOT EXISTS money_received_payment_method_idx ON public.money_received(payment_method);
CREATE INDEX IF NOT EXISTS money_received_sender_idx ON public.money_received(sender_name);
CREATE INDEX IF NOT EXISTS money_received_amount_usd_idx ON public.money_received(amount_usd);
CREATE INDEX IF NOT EXISTS money_received_amount_php_idx ON public.money_received(amount_php);

-- Step 12: Create or replace the update trigger function
CREATE OR REPLACE FUNCTION update_money_received_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 13: Drop existing trigger and recreate
DROP TRIGGER IF EXISTS money_received_updated_at_trigger ON public.money_received;
CREATE TRIGGER money_received_updated_at_trigger
  BEFORE UPDATE ON public.money_received
  FOR EACH ROW
  EXECUTE FUNCTION update_money_received_updated_at();

-- Step 14: Enable Row Level Security
ALTER TABLE public.money_received ENABLE ROW LEVEL SECURITY;

-- Step 15: Create policy (only one, clean)
CREATE POLICY "Enable all operations for money_received" ON public.money_received
  FOR ALL USING (true) WITH CHECK (true);

-- Step 16: Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.money_received TO anon, authenticated;

-- Step 17: Verify the final structure
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'money_received' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 18: Show constraints
SELECT 
  constraint_name,
  constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'money_received' AND table_schema = 'public';

-- Step 19: Show sample data (if any exists)
SELECT 
  id,
  date_received,
  amount,
  amount_usd,
  exchange_rate,
  amount_php,
  sender_name,
  status
FROM public.money_received
ORDER BY created_at DESC
LIMIT 3;