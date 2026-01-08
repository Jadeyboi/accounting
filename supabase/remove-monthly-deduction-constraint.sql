-- Remove monthly_deduction constraint and add bimonthly_deduction
-- Run this in Supabase SQL Editor

-- Step 1: Add bimonthly_deduction column
ALTER TABLE public.loans 
ADD COLUMN IF NOT EXISTS bimonthly_deduction DECIMAL(12,2);

-- Step 2: Copy monthly_deduction to bimonthly_deduction (divide by 2 for true bi-monthly)
UPDATE public.loans 
SET bimonthly_deduction = CASE 
    WHEN monthly_deduction IS NOT NULL THEN monthly_deduction / 2
    ELSE 500  -- Default bi-monthly amount
END
WHERE bimonthly_deduction IS NULL;

-- Step 3: Make bimonthly_deduction NOT NULL
ALTER TABLE public.loans 
ALTER COLUMN bimonthly_deduction SET NOT NULL;

-- Step 4: Add constraint for bimonthly_deduction
ALTER TABLE public.loans 
ADD CONSTRAINT loans_bimonthly_deduction_positive CHECK (bimonthly_deduction > 0);

-- Step 5: Remove NOT NULL constraint from monthly_deduction
ALTER TABLE public.loans 
ALTER COLUMN monthly_deduction DROP NOT NULL;

-- Step 6: (Optional) Drop monthly_deduction column entirely
-- Uncomment the next line if you want to completely remove the old column
-- ALTER TABLE public.loans DROP COLUMN monthly_deduction;

-- Step 7: Verify the structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'loans' 
AND column_name IN ('monthly_deduction', 'bimonthly_deduction');