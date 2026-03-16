-- Employee Salary History & Termination Tracking
-- Run this in your Supabase SQL editor

-- 1. Add termination fields to employees table
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS termination_date date,
  ADD COLUMN IF NOT EXISTS termination_reason text,
  ADD COLUMN IF NOT EXISTS termination_notes text,
  ADD COLUMN IF NOT EXISTS last_working_day date,
  ADD COLUMN IF NOT EXISTS terminated_by text;

-- Update status check to allow 'terminated'
-- (if you have a check constraint on status, drop and recreate it)
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_status_check;
ALTER TABLE employees ADD CONSTRAINT employees_status_check
  CHECK (status IN ('active', 'inactive', 'terminated'));

-- 2. Create salary_history table
CREATE TABLE IF NOT EXISTS salary_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  previous_salary numeric,
  new_salary numeric NOT NULL,
  increase_amount numeric GENERATED ALWAYS AS (new_salary - COALESCE(previous_salary, 0)) STORED,
  effective_date date NOT NULL,
  reason text, -- e.g. 'Annual Review', 'Promotion', 'Cost of Living', 'Merit Increase'
  approved_by text,
  notes text
);

-- Enable RLS
ALTER TABLE salary_history ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users
CREATE POLICY "Allow all for authenticated" ON salary_history
  FOR ALL USING (auth.role() = 'authenticated');

-- Index for fast lookups by employee
CREATE INDEX IF NOT EXISTS idx_salary_history_employee_id ON salary_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_history_effective_date ON salary_history(effective_date DESC);
