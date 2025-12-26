-- Clear all data from all tables
-- WARNING: This will permanently delete ALL data from the database!

-- Delete in order to respect foreign key constraints
DELETE FROM public.payslips;
DELETE FROM public.employees;
DELETE FROM public.transactions;
DELETE FROM public.savings;

-- Optional: Reset sequences if you want IDs to start from 1 again
-- (Not needed for UUID-based tables, but included for reference)

-- Verify deletion
SELECT 'employees' as table_name, COUNT(*) as remaining_rows FROM public.employees
UNION ALL
SELECT 'payslips', COUNT(*) FROM public.payslips
UNION ALL
SELECT 'transactions', COUNT(*) FROM public.transactions
UNION ALL
SELECT 'savings', COUNT(*) FROM public.savings;
