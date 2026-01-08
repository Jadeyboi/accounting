-- Money Received Tracking System
-- Run this in Supabase SQL Editor

-- Create money_received table
CREATE TABLE IF NOT EXISTS public.money_received (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date_received DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  sender_name TEXT NOT NULL,
  sender_contact TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('bank_transfer', 'cash', 'check', 'gcash', 'paymaya', 'paypal', 'other')),
  reference_number TEXT,
  purpose TEXT NOT NULL,
  category TEXT,
  notes TEXT,
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cleared')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS money_received_date_idx ON public.money_received(date_received);
CREATE INDEX IF NOT EXISTS money_received_status_idx ON public.money_received(status);
CREATE INDEX IF NOT EXISTS money_received_payment_method_idx ON public.money_received(payment_method);
CREATE INDEX IF NOT EXISTS money_received_sender_idx ON public.money_received(sender_name);
CREATE INDEX IF NOT EXISTS money_received_amount_idx ON public.money_received(amount);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_money_received_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS money_received_updated_at_trigger ON public.money_received;
CREATE TRIGGER money_received_updated_at_trigger
  BEFORE UPDATE ON public.money_received
  FOR EACH ROW
  EXECUTE FUNCTION update_money_received_updated_at();

-- Enable Row Level Security
ALTER TABLE public.money_received ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (adjust based on your auth setup)
CREATE POLICY "Enable all operations for money_received" ON public.money_received
  FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.money_received TO anon, authenticated;

-- Comments for documentation
COMMENT ON TABLE public.money_received IS 'Track all incoming money and payments received';
COMMENT ON COLUMN public.money_received.date_received IS 'Date when the money was received';
COMMENT ON COLUMN public.money_received.amount IS 'Amount received in PHP';
COMMENT ON COLUMN public.money_received.sender_name IS 'Name of person or company who sent the money';
COMMENT ON COLUMN public.money_received.sender_contact IS 'Contact information of sender (phone, email, etc.)';
COMMENT ON COLUMN public.money_received.payment_method IS 'Method used for payment: bank_transfer, cash, check, gcash, paymaya, paypal, other';
COMMENT ON COLUMN public.money_received.reference_number IS 'Transaction reference number or check number';
COMMENT ON COLUMN public.money_received.purpose IS 'Purpose or reason for the payment';
COMMENT ON COLUMN public.money_received.category IS 'Category of income (e.g., Client Payment, Loan, Investment)';
COMMENT ON COLUMN public.money_received.status IS 'Payment status: pending, confirmed, cleared';
COMMENT ON COLUMN public.money_received.receipt_url IS 'URL to receipt or proof of payment document';

-- Insert sample data (optional)
INSERT INTO public.money_received (
  date_received,
  amount,
  sender_name,
  sender_contact,
  payment_method,
  reference_number,
  purpose,
  category,
  status,
  notes
) VALUES 
(
  CURRENT_DATE,
  50000.00,
  'ABC Corporation',
  'finance@abccorp.com',
  'bank_transfer',
  'TXN123456789',
  'Website development project payment',
  'Client Payment',
  'confirmed',
  'First milestone payment for Q1 project'
),
(
  CURRENT_DATE - INTERVAL '1 day',
  25000.00,
  'John Doe',
  '+63 912 345 6789',
  'gcash',
  'GC987654321',
  'Consulting services',
  'Client Payment',
  'cleared',
  'Monthly retainer fee'
);