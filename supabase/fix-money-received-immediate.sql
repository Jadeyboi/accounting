-- Immediate fix for money_received table schema issue
-- This script fixes the "null value in column 'amount'" error

-- Step 1: Check current table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'money_received' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 2: Make the old 'amount' column nullable if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'money_received' 
               AND column_name = 'amount' 
               AND is_nullable = 'NO') THEN
        ALTER TABLE public.money_received ALTER COLUMN amount DROP NOT NULL;
        RAISE NOTICE 'Made amount column nullable';
    END IF;
END $$;

-- Step 3: Add USD columns if they don't exist
ALTER TABLE public.money_received 
ADD COLUMN IF NOT EXISTS amount_usd DECIMAL(12,2);

ALTER TABLE public.money_received 
ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(8,4);

ALTER TABLE public.money_received 
ADD COLUMN IF NOT EXISTS amount_php DECIMAL(12,2);

-- Step 4: Set default values for existing records
UPDATE public.money_received 
SET 
  amount_usd = COALESCE(amount_usd, COALESCE(amount / 56.0, 100)),
  exchange_rate = COALESCE(exchange_rate, 56.0),
  amount_php = COALESCE(amount_php, COALESCE(amount, 5600))
WHERE amount_usd IS NULL OR exchange_rate IS NULL OR amount_php IS NULL;

-- Step 5: Make USD columns NOT NULL after setting values
ALTER TABLE public.money_received 
ALTER COLUMN amount_usd SET NOT NULL;

ALTER TABLE public.money_received 
ALTER COLUMN exchange_rate SET NOT NULL;

ALTER TABLE public.money_received 
ALTER COLUMN amount_php SET NOT NULL;

-- Step 6: Add positive value constraints (remove existing ones first)
DO $$ 
BEGIN
    -- Drop existing constraints to avoid conflicts
    BEGIN
        ALTER TABLE public.money_received DROP CONSTRAINT IF EXISTS money_received_amount_usd_positive;
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Ignore if constraint doesn't exist
    END;
    
    BEGIN
        ALTER TABLE public.money_received DROP CONSTRAINT IF EXISTS money_received_exchange_rate_positive;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
    
    BEGIN
        ALTER TABLE public.money_received DROP CONSTRAINT IF EXISTS money_received_amount_php_positive;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
END $$;

-- Add new constraints
ALTER TABLE public.money_received 
ADD CONSTRAINT money_received_amount_usd_positive CHECK (amount_usd > 0);

ALTER TABLE public.money_received 
ADD CONSTRAINT money_received_exchange_rate_positive CHECK (exchange_rate > 0);

ALTER TABLE public.money_received 
ADD CONSTRAINT money_received_amount_php_positive CHECK (amount_php > 0);

-- Step 7: Add indexes for better performance
CREATE INDEX IF NOT EXISTS money_received_amount_usd_idx ON public.money_received(amount_usd);
CREATE INDEX IF NOT EXISTS money_received_amount_php_idx ON public.money_received(amount_php);

-- Step 8: Verify the final structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'money_received' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 9: Show sample data to verify
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

RAISE NOTICE 'Money received table schema has been updated successfully!';