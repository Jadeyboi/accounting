-- Simple Loans Setup for Supabase
-- Run this in Supabase SQL Editor (run each section separately if needed)

-- Create loans table with bimonthly_deduction
CREATE TABLE IF NOT EXISTS public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  loan_type TEXT NOT NULL CHECK (loan_type IN ('cash_advance', 'emergency_loan', 'salary_loan', 'equipment_loan', 'other')),
  principal_amount DECIMAL(12,2) NOT NULL CHECK (principal_amount > 0),
  interest_rate DECIMAL(5,2) DEFAULT 0 CHECK (interest_rate >= 0),
  total_amount DECIMAL(12,2) NOT NULL CHECK (total_amount > 0),
  bimonthly_deduction DECIMAL(12,2) NOT NULL CHECK (bimonthly_deduction > 0),
  remaining_balance DECIMAL(12,2) NOT NULL CHECK (remaining_balance >= 0),
  loan_date DATE NOT NULL,
  start_deduction_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  purpose TEXT,
  notes TEXT,
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create loan payments table
CREATE TABLE IF NOT EXISTS public.loan_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  payslip_id UUID REFERENCES public.payslips(id) ON DELETE SET NULL,
  payment_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  balance_before DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  payment_type TEXT NOT NULL DEFAULT 'payroll_deduction' CHECK (payment_type IN ('payroll_deduction', 'manual_payment', 'adjustment')),
  notes TEXT
);

-- Add indexes
CREATE INDEX IF NOT EXISTS loans_employee_id_idx ON public.loans(employee_id);
CREATE INDEX IF NOT EXISTS loans_status_idx ON public.loans(status);
CREATE INDEX IF NOT EXISTS loans_loan_type_idx ON public.loans(loan_type);
CREATE INDEX IF NOT EXISTS loans_start_deduction_date_idx ON public.loans(start_deduction_date);
CREATE INDEX IF NOT EXISTS loan_payments_loan_id_idx ON public.loan_payments(loan_id);
CREATE INDEX IF NOT EXISTS loan_payments_payslip_id_idx ON public.loan_payments(payslip_id);
CREATE INDEX IF NOT EXISTS loan_payments_payment_date_idx ON public.loan_payments(payment_date);

-- Enable Row Level Security
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_payments ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Enable all operations for loans" ON public.loans;
CREATE POLICY "Enable all operations for loans" ON public.loans
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all operations for loan_payments" ON public.loan_payments;
CREATE POLICY "Enable all operations for loan_payments" ON public.loan_payments
  FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.loans TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.loan_payments TO anon, authenticated;

-- Add loan_deductions column to payslips
ALTER TABLE public.payslips 
ADD COLUMN IF NOT EXISTS loan_deductions DECIMAL(12,2) DEFAULT 0 CHECK (loan_deductions >= 0);

-- Update existing payslips
UPDATE public.payslips 
SET loan_deductions = 0 
WHERE loan_deductions IS NULL;