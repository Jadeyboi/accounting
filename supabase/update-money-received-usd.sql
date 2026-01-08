-- Update existing money_received table to support USD
-- Run this if you already have a money_received table

-- Step 1: Add new columns for USD support
ALTER TABLE public.money_received 
ADD COLUMN IF NOT EXISTS amount_usd DECIMAL(12,2);

ALTER TABLE public.money_received 
ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(8,4);

ALTER TABLE public.money_received 
ADD COLUMN IF NOT EXISTS amount_php DECIMAL(12,2);

-- Step 2: For existing records, convert PHP amount to USD using default rate
-- You can adjust the default rate (56.0) as needed
UPDATE public.money_received 
SET 
  amount_usd = COALESCE(amount / 56.0, 100),
  exchange_rate = 56.0,
  amount_php = COALESCE(amount, 5600)
WHERE amount_usd IS NULL;

-- Step 3: Make the old amount column nullable (remove NOT NULL constraint)
ALTER TABLE public.money_received 
ALTER COLUMN amount DROP NOT NULL;

-- Step 4: Make the new columns NOT NULL after setting values
ALTER TABLE public.money_received 
ALTER COLUMN amount_usd SET NOT NULL;

ALTER TABLE public.money_received 
ALTER COLUMN exchange_rate SET NOT NULL;

ALTER TABLE public.money_received 
ALTER COLUMN amount_php SET NOT NULL;

-- Step 5: Add constraints (drop existing ones first to avoid conflicts)
DO $$ 
BEGIN
    -- Drop constraints if they exist
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'money_received_amount_usd_positive' 
               AND table_name = 'money_received') THEN
        ALTER TABLE public.money_received DROP CONSTRAINT money_received_amount_usd_positive;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'money_received_exchange_rate_positive' 
               AND table_name = 'money_received') THEN
        ALTER TABLE public.money_received DROP CONSTRAINT money_received_exchange_rate_positive;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'money_received_amount_php_positive' 
               AND table_name = 'money_received') THEN
        ALTER TABLE public.money_received DROP CONSTRAINT money_received_amount_php_positive;
    END IF;
END $$;

-- Add new constraints
ALTER TABLE public.money_received 
ADD CONSTRAINT money_received_amount_usd_positive CHECK (amount_usd > 0);

ALTER TABLE public.money_received 
ADD CONSTRAINT money_received_exchange_rate_positive CHECK (exchange_rate > 0);

ALTER TABLE public.money_received 
ADD CONSTRAINT money_received_amount_php_positive CHECK (amount_php > 0);

-- Step 6: Add indexes for the new columns
CREATE INDEX IF NOT EXISTS money_received_amount_usd_idx ON public.money_received(amount_usd);
CREATE INDEX IF NOT EXISTS money_received_amount_php_idx ON public.money_received(amount_php);

-- Step 7: Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'money_received'
ORDER BY ordinal_position;

-- Show sample data
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
LIMIT 5;