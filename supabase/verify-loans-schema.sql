-- Verify Loans Schema
-- Run this to check the current state of your loans tables

-- Check if loans table exists and its structure
SELECT 
    'loans_table_exists' as check_type,
    CASE 
        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'loans') 
        THEN 'YES' 
        ELSE 'NO' 
    END as result;

-- Check loans table columns
SELECT 
    'loans_columns' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'loans'
ORDER BY ordinal_position;

-- Check if loan_payments table exists
SELECT 
    'loan_payments_table_exists' as check_type,
    CASE 
        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'loan_payments') 
        THEN 'YES' 
        ELSE 'NO' 
    END as result;

-- Check payslips table for loan_deductions column
SELECT 
    'payslips_loan_deductions_column' as check_type,
    CASE 
        WHEN EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payslips' AND column_name = 'loan_deductions') 
        THEN 'YES' 
        ELSE 'NO' 
    END as result;

-- Check for any existing loans data
SELECT 
    'existing_loans_count' as check_type,
    CASE 
        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'loans') 
        THEN (SELECT COUNT(*)::text FROM public.loans)
        ELSE 'Table does not exist' 
    END as result;