-- Final fix for loans table - handles all edge cases
-- Run this in Supabase SQL Editor

-- Step 1: Add bimonthly_deduction column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loans' AND column_name = 'bimonthly_deduction') THEN
        ALTER TABLE public.loans ADD COLUMN bimonthly_deduction DECIMAL(12,2);
    END IF;
END $$;

-- Step 2: Update bimonthly_deduction values
UPDATE public.loans 
SET bimonthly_deduction = CASE 
    WHEN monthly_deduction IS NOT NULL THEN monthly_deduction / 2
    ELSE 500
END
WHERE bimonthly_deduction IS NULL;

-- Step 3: Make bimonthly_deduction NOT NULL
ALTER TABLE public.loans 
ALTER COLUMN bimonthly_deduction SET NOT NULL;

-- Step 4: Add constraint only if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'loans_bimonthly_deduction_positive') THEN
        ALTER TABLE public.loans ADD CONSTRAINT loans_bimonthly_deduction_positive CHECK (bimonthly_deduction > 0);
    END IF;
END $$;

-- Step 5: Remove NOT NULL constraint from monthly_deduction
ALTER TABLE public.loans 
ALTER COLUMN monthly_deduction DROP NOT NULL;

-- Step 6: Verify the changes
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'loans' 
AND column_name IN ('monthly_deduction', 'bimonthly_deduction')
ORDER BY column_name;