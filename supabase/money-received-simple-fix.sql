-- Simple and clean fix for money_received table
-- This script resolves the schema mismatch without complex syntax

-- Step 1: Make old amount column nullable if it exists
ALTER TABLE public.money_received 
ALTER COLUMN amount DROP NOT NULL;

-- Step 2: Add USD columns if they don't exist
ALTER TABLE public.money_received 
ADD COLUMN IF NOT EXISTS amount_usd DECIMAL(12,2);

ALTER TABLE public.money_received 
ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(8,4);

ALTER TABLE public.money_received 
ADD COLUMN IF NOT EXISTS amount_php DECIMAL(12,2);

-- Step 3: Set default values for existing records
UPDATE public.money_received 
SET 
  amount_usd = COALESCE(amount_usd, 100),
  exchange_rate = COALESCE(exchange_rate, 56.0),
  amount_php = COALESCE(amount_php, 5600)
WHERE amount_usd IS NULL OR exchange_rate IS NULL OR amount_php IS NULL;

-- Step 4: Make USD columns NOT NULL
ALTER TABLE public.money_received 
ALTER COLUMN amount_usd SET NOT NULL;

ALTER TABLE public.money_received 
ALTER COLUMN exchange_rate SET NOT NULL;

ALTER TABLE public.money_received 
ALTER COLUMN amount_php SET NOT NULL;

-- Step 5: Add constraints (drop first to avoid conflicts)
ALTER TABLE public.money_received 
DROP CONSTRAINT IF EXISTS money_received_amount_usd_positive;

ALTER TABLE public.money_received 
DROP CONSTRAINT IF EXISTS money_received_exchange_rate_positive;

ALTER TABLE public.money_received 
DROP CONSTRAINT IF EXISTS money_received_amount_php_positive;

ALTER TABLE public.money_received 
ADD CONSTRAINT money_received_amount_usd_positive CHECK (amount_usd > 0);

ALTER TABLE public.money_received 
ADD CONSTRAINT money_received_exchange_rate_positive CHECK (exchange_rate > 0);

ALTER TABLE public.money_received 
ADD CONSTRAINT money_received_amount_php_positive CHECK (amount_php > 0);

-- Step 6: Add indexes
CREATE INDEX IF NOT EXISTS money_received_amount_usd_idx ON public.money_received(amount_usd);
CREATE INDEX IF NOT EXISTS money_received_amount_php_idx ON public.money_received(amount_php);

-- Step 7: Verify structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'money_received' AND table_schema = 'public'
ORDER BY ordinal_position;