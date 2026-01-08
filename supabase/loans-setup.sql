-- Loans Management System
-- Run this in Supabase SQL Editor

-- Create loans table
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

-- Create loan payments table for tracking individual payments
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

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS loans_employee_id_idx ON public.loans(employee_id);
CREATE INDEX IF NOT EXISTS loans_status_idx ON public.loans(status);
CREATE INDEX IF NOT EXISTS loans_loan_type_idx ON public.loans(loan_type);
CREATE INDEX IF NOT EXISTS loans_start_deduction_date_idx ON public.loans(start_deduction_date);
CREATE INDEX IF NOT EXISTS loan_payments_loan_id_idx ON public.loan_payments(loan_id);
CREATE INDEX IF NOT EXISTS loan_payments_payslip_id_idx ON public.loan_payments(payslip_id);
CREATE INDEX IF NOT EXISTS loan_payments_payment_date_idx ON public.loan_payments(payment_date);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_loans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS loans_updated_at_trigger ON public.loans;
CREATE TRIGGER loans_updated_at_trigger
  BEFORE UPDATE ON public.loans
  FOR EACH ROW
  EXECUTE FUNCTION update_loans_updated_at();

-- Enable Row Level Security
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_payments ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (adjust based on your auth setup)
CREATE POLICY "Enable all operations for loans" ON public.loans
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all operations for loan_payments" ON public.loan_payments
  FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.loans TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.loan_payments TO anon, authenticated;

-- Comments for documentation
COMMENT ON TABLE public.loans IS 'Employee loans and advances with automatic payroll deduction';
COMMENT ON TABLE public.loan_payments IS 'Individual loan payment records linked to payslips';

COMMENT ON COLUMN public.loans.loan_type IS 'Type of loan: cash_advance, emergency_loan, salary_loan, equipment_loan, other';
COMMENT ON COLUMN public.loans.principal_amount IS 'Original loan amount without interest';
COMMENT ON COLUMN public.loans.interest_rate IS 'Annual interest rate percentage (0 for no interest)';
COMMENT ON COLUMN public.loans.total_amount IS 'Total amount to be repaid (principal + interest)';
COMMENT ON COLUMN public.loans.bimonthly_deduction IS 'Amount to deduct from each payroll (twice per month)';
COMMENT ON COLUMN public.loans.remaining_balance IS 'Current outstanding balance';
COMMENT ON COLUMN public.loans.start_deduction_date IS 'Date when payroll deductions should start';
COMMENT ON COLUMN public.loans.status IS 'Loan status: active, completed, cancelled';

COMMENT ON COLUMN public.loan_payments.payment_type IS 'Type of payment: payroll_deduction, manual_payment, adjustment';
COMMENT ON COLUMN public.loan_payments.balance_before IS 'Loan balance before this payment';
COMMENT ON COLUMN public.loan_payments.balance_after IS 'Loan balance after this payment';