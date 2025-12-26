-- Add additional employee fields for HRIS
-- Run this in Supabase SQL Editor

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS employee_number TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS birthdate DATE,
  ADD COLUMN IF NOT EXISTS date_hired DATE,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT,
  ADD COLUMN IF NOT EXISTS sss_number TEXT,
  ADD COLUMN IF NOT EXISTS philhealth_number TEXT,
  ADD COLUMN IF NOT EXISTS pagibig_number TEXT,
  ADD COLUMN IF NOT EXISTS tin_number TEXT;

-- Add unique constraint on employee_number if it exists
CREATE UNIQUE INDEX IF NOT EXISTS employees_employee_number_key 
  ON public.employees(employee_number) 
  WHERE employee_number IS NOT NULL;

-- Add index for faster searches
CREATE INDEX IF NOT EXISTS employees_email_idx ON public.employees(email);
CREATE INDEX IF NOT EXISTS employees_status_idx ON public.employees(status);
CREATE INDEX IF NOT EXISTS employees_department_idx ON public.employees(department);
