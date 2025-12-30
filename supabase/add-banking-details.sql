-- Add banking details fields to employees table
-- Run this in Supabase SQL Editor

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_branch TEXT;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS employees_bank_account_number_idx ON public.employees(bank_account_number);

COMMENT ON COLUMN public.employees.bank_name IS 'Name of the bank (e.g., BDO, BPI, Metrobank)';
COMMENT ON COLUMN public.employees.bank_account_number IS 'Bank account number for salary deposit';
COMMENT ON COLUMN public.employees.bank_account_name IS 'Name on the bank account';
COMMENT ON COLUMN public.employees.bank_branch IS 'Bank branch location';
