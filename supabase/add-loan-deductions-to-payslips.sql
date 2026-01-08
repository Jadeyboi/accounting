-- Add loan_deductions column to payslips table
-- Run this in Supabase SQL Editor

-- Add loan_deductions column to payslips table
ALTER TABLE public.payslips 
ADD COLUMN IF NOT EXISTS loan_deductions DECIMAL(12,2) DEFAULT 0 CHECK (loan_deductions >= 0);

-- Add comment for documentation
COMMENT ON COLUMN public.payslips.loan_deductions IS 'Total loan deductions for this payslip period';

-- Update existing payslips to have 0 loan deductions if null
UPDATE public.payslips 
SET loan_deductions = 0 
WHERE loan_deductions IS NULL;