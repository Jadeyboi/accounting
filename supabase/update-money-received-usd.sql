-- Update existing money_received table to support USD
-- Run this if you already have a money_received table

-- Add new columns for USD support
ALTER TABLE public.money_received 
ADD COLUMN IF NOT EXISTS amount_usd DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(8,4),
ADD COLUMN IF NOT EXISTS amount_php DECIMAL(12,2);

-- For existing records, assume they were in PHP and convert to USD using current rate
-- You can adjust the default rate (56.0) as needed
UPDATE public.money_received 
SET 
  amount_usd = amount / 56.0,
  exchange_rate = 56.0,
  amount_php = amount
WHERE amount_usd IS NULL AND amount IS NOT NULL;

-- Set default values for any remaining null records
UPDATE public.money_received 
SET 
  amount_usd = 0,
  exchange_rate = 56.0,
  amount_php = 0
WHERE amount_usd IS NULL;

-- Make the new columns NOT NULL
ALTER TABLE public.money_received 
ALTER COLUMN amount_usd SET NOT NULL,
ALTER COLUMN exchange_rate SET NOT NULL,
ALTER COLUMN amount_php SET NOT NULL;

-- Add constraints
ALTER TABLE public.money_received 
ADD CONSTRAINT money_received_amount_usd_positive CHECK (amount_usd > 0),
ADD CONSTRAINT money_received_exchange_rate_positive CHECK (exchange_rate > 0),
ADD CONSTRAINT money_received_amount_php_positive CHECK (amount_php > 0);

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS money_received_amount_usd_idx ON public.money_received(amount_usd);
CREATE INDEX IF NOT EXISTS money_received_amount_php_idx ON public.money_received(amount_php);

-- (Optional) Drop the old amount column after verifying data
-- ALTER TABLE public.money_received DROP COLUMN IF EXISTS amount;

-- Verify the changes
SELECT 
  id,
  date_received,
  amount_usd,
  exchange_rate,
  amount_php,
  sender_name,
  status
FROM public.money_received
LIMIT 5;