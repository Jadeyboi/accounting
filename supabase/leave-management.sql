-- Leave Management System
-- Run this in Supabase SQL Editor

-- Create leave_requests table
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('sick', 'vacation', 'birthday', 'emergency', 'unpaid')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count DECIMAL(4,1) NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Add leave balance fields to employees table
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS sick_leave_balance DECIMAL(4,1) DEFAULT 2.0,
  ADD COLUMN IF NOT EXISTS vacation_leave_balance DECIMAL(4,1) DEFAULT 2.0,
  ADD COLUMN IF NOT EXISTS birthday_leave_balance DECIMAL(4,1) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS employment_status TEXT DEFAULT 'probationary' CHECK (employment_status IN ('probationary', 'regular')),
  ADD COLUMN IF NOT EXISTS regularization_date DATE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS leave_requests_employee_id_idx ON public.leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS leave_requests_status_idx ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS leave_requests_leave_type_idx ON public.leave_requests(leave_type);
CREATE INDEX IF NOT EXISTS leave_requests_start_date_idx ON public.leave_requests(start_date);

-- Enable Row Level Security (optional, but recommended)
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your auth setup)
CREATE POLICY "Enable all operations for leave_requests" ON public.leave_requests
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.leave_requests IS 'Stores employee leave requests and their approval status';
COMMENT ON COLUMN public.employees.sick_leave_balance IS 'Sick leave days: 2 for probationary, 6 for regular (8 if regularized before January)';
COMMENT ON COLUMN public.employees.vacation_leave_balance IS 'Vacation leave days: 2 for probationary, 6 for regular (8 if regularized before January)';
COMMENT ON COLUMN public.employees.birthday_leave_balance IS 'Birthday leave: 1 day per year';
COMMENT ON COLUMN public.employees.employment_status IS 'Employment status: probationary or regular';
COMMENT ON COLUMN public.employees.regularization_date IS 'Date when employee was regularized';
