-- Convert existing loans from monthly to bimonthly deductions
-- Run this ONLY if you have existing loans with monthly_deduction column

-- Step 1: Add bimonthly_deduction column
ALTER TABLE public.loans 
ADD COLUMN IF NOT EXISTS bimonthly_deduction DECIMAL(12,2);

-- Step 2: Convert monthly_deduction to bimonthly_deduction (divide by 2)
UPDATE public.loans 
SET bimonthly_deduction = monthly_deduction / 2 
WHERE bimonthly_deduction IS NULL AND monthly_deduction IS NOT NULL;

-- Step 3: Set default for any remaining null values
UPDATE public.loans 
SET bimonthly_deduction = 1000 
WHERE bimonthly_deduction IS NULL OR bimonthly_deduction = 0;

-- Step 4: Make bimonthly_deduction NOT NULL
ALTER TABLE public.loans 
ALTER COLUMN bimonthly_deduction SET NOT NULL;

-- Step 5: Add constraint
ALTER TABLE public.loans 
ADD CONSTRAINT loans_bimonthly_deduction_positive CHECK (bimonthly_deduction > 0);

-- Step 6: (Optional) Drop monthly_deduction column
-- Uncomment the next line if you want to remove the old column
-- ALTER TABLE public.loans DROP COLUMN IF EXISTS monthly_deduction;