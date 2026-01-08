-- Update loans table to use bimonthly deductions instead of monthly
-- Run this in Supabase SQL Editor

-- Add new bimonthly_deduction column
ALTER TABLE public.loans 
ADD COLUMN IF NOT EXISTS bimonthly_deduction DECIMAL(12,2) CHECK (bimonthly_deduction >= 0);

-- Copy monthly_deduction values to bimonthly_deduction (divide by 2 since we pay twice per month)
UPDATE public.loans 
SET bimonthly_deduction = monthly_deduction / 2 
WHERE bimonthly_deduction IS NULL AND monthly_deduction IS NOT NULL;

-- For new loans without monthly_deduction, set bimonthly_deduction to 0
UPDATE public.loans 
SET bimonthly_deduction = 0 
WHERE bimonthly_deduction IS NULL;

-- Make bimonthly_deduction NOT NULL and add constraint
ALTER TABLE public.loans 
ALTER COLUMN bimonthly_deduction SET NOT NULL,
ADD CONSTRAINT loans_bimonthly_deduction_positive CHECK (bimonthly_deduction > 0);

-- Drop the old monthly_deduction column (optional - comment out if you want to keep it for reference)
-- ALTER TABLE public.loans DROP COLUMN IF EXISTS monthly_deduction;

-- Add comment for documentation
COMMENT ON COLUMN public.loans.bimonthly_deduction IS 'Amount to deduct from each payroll (twice per month)';

-- Update any existing loan payment records to reflect the new structure
-- This is informational - existing payment records remain valid