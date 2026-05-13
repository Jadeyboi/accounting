-- Add holiday pay field to payslips
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS holiday_pay numeric DEFAULT 0;
