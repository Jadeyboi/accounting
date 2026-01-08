-- Fix existing loans table to work with bimonthly deductions
-- Run this in Supabase SQL Editor

-- Step 1: Check current table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'loans'
ORDER BY ordinal_position;

-- Step 2: Add bimonthly_deduction column if it doesn't exist
ALTER TABLE public.loans 
ADD COLUMN IF NOT EXISTS bimonthly_deduction DECIMAL(12,2);

-- Step 3: If monthly_deduction exists, copy its values to bimonthly_deduction
-- (We'll keep the same value for now, you can adjust later)
UPDATE public.loans 
SET bimonthly_deduction = COALESCE(monthly_deduction, 1000)
WHERE bimonthly_deduction IS NULL;

-- Step 4: Make bimonthly_deduction NOT NULL
ALTER TABLE public.loans 
ALTER COLUMN bimonthly_deduction SET NOT NULL;

-- Step 5: Add constraint for bimonthly_deduction
ALTER TABLE public.loans 
ADD CONSTRAINT IF NOT EXISTS loans_bimonthly_deduction_positive 
CHECK (bimonthly_deduction > 0);

-- Step 6: Make monthly_deduction nullable (remove NOT NULL constraint)
ALTER TABLE public.loans 
ALTER COLUMN monthly_deduction DROP NOT NULL;

-- Step 7: Set monthly_deduction to NULL for existing records (optional)
-- This allows the app to work with bimonthly_deduction
UPDATE public.loans 
SET monthly_deduction = NULL;

-- Step 8: Verify the changes
SELECT 
    id,
    employee_id,
    loan_type,
    principal_amount,
    monthly_deduction,
    bimonthly_deduction,
    status
FROM public.loans
LIMIT 5;