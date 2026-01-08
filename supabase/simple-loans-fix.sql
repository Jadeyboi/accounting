-- Simple fix for loans table - run each step separately if needed
-- Run this in Supabase SQL Editor

-- Step 1: Add bimonthly_deduction column (ignore error if exists)
ALTER TABLE public.loans 
ADD COLUMN IF NOT EXISTS bimonthly_deduction DECIMAL(12,2);

-- Step 2: Update bimonthly_deduction values for any NULL entries
UPDATE public.loans 
SET bimonthly_deduction = COALESCE(monthly_deduction / 2, 500)
WHERE bimonthly_deduction IS NULL;

-- Step 3: Make bimonthly_deduction NOT NULL
ALTER TABLE public.loans 
ALTER COLUMN bimonthly_deduction SET NOT NULL;

-- Step 4: Remove NOT NULL constraint from monthly_deduction
ALTER TABLE public.loans 
ALTER COLUMN monthly_deduction DROP NOT NULL;

-- Step 5: Check the result
SELECT COUNT(*) as total_loans FROM public.loans;

-- Step 6: Show sample data
SELECT 
    id,
    loan_type,
    principal_amount,
    monthly_deduction,
    bimonthly_deduction,
    status
FROM public.loans 
LIMIT 3;