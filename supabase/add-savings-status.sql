-- Add status column to savings table
-- This allows marking savings as 'paid' while keeping the record for future reference

-- Step 1: Add status column with default 'active'
ALTER TABLE savings 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Step 2: Add check constraint
ALTER TABLE savings 
DROP CONSTRAINT IF EXISTS savings_status_check;

ALTER TABLE savings 
ADD CONSTRAINT savings_status_check CHECK (status IN ('active', 'paid'));

-- Step 3: Update existing records to have 'active' status
UPDATE savings 
SET status = 'active' 
WHERE status IS NULL;

-- Step 4: Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_savings_status ON savings(status);

-- Step 5: Verify the changes
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'savings' 
  AND column_name = 'status';

-- Step 6: Show sample data
SELECT id, date, description, amount, account, status 
FROM savings 
LIMIT 5;
