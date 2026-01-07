-- Add personal details fields to employees table
-- Run this in Supabase SQL Editor

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  ADD COLUMN IF NOT EXISTS marital_status TEXT CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed'));

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS employees_gender_idx ON public.employees(gender);
CREATE INDEX IF NOT EXISTS employees_marital_status_idx ON public.employees(marital_status);

COMMENT ON COLUMN public.employees.gender IS 'Employee gender: male, female, or other';
COMMENT ON COLUMN public.employees.marital_status IS 'Employee marital status: single, married, divorced, or widowed';
