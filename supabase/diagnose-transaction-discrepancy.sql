-- Diagnostic Query to Find Transaction Discrepancies
-- Run this in Supabase SQL Editor to investigate the 600,000 difference

-- 1. Check total transactions by type
SELECT 
  type,
  COUNT(*) as transaction_count,
  SUM(amount) as total_amount,
  ROUND(AVG(amount), 2) as avg_amount
FROM transactions
GROUP BY type
ORDER BY type;

-- 2. Check payroll transactions specifically
SELECT 
  COUNT(*) as payroll_transaction_count,
  SUM(amount) as total_payroll_expenses
FROM transactions
WHERE category = 'Payroll' AND type = 'expense';

-- 3. Compare payroll transactions vs payslips
SELECT 
  'Payslips Total (Gross)' as source,
  COUNT(*) as count,
  SUM(gross_salary) as total_amount
FROM payslips
UNION ALL
SELECT 
  'Payslips Total (Net)' as source,
  COUNT(*) as count,
  SUM(net_salary) as total_amount
FROM payslips
UNION ALL
SELECT 
  'Payroll Transactions' as source,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM transactions
WHERE category = 'Payroll';

-- 4. Find payslips without matching transactions
SELECT 
  p.id,
  p.employee_id,
  p.date_issued,
  p.gross_salary,
  p.net_salary,
  p.transaction_id,
  t.amount as transaction_amount,
  (p.gross_salary - COALESCE(t.amount, 0)) as difference
FROM payslips p
LEFT JOIN transactions t ON p.transaction_id = t.id
WHERE p.transaction_id IS NULL OR t.id IS NULL OR ABS(p.gross_salary - t.amount) > 0.01
ORDER BY p.date_issued DESC;

-- 5. Check for duplicate transactions
SELECT 
  date,
  type,
  amount,
  category,
  note,
  COUNT(*) as duplicate_count
FROM transactions
GROUP BY date, type, amount, category, note
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, amount DESC;

-- 6. Summary of all transaction types
SELECT 
  'Total Cash In' as metric,
  SUM(amount) as amount
FROM transactions
WHERE type = 'in'
UNION ALL
SELECT 
  'Total Cash Out' as metric,
  SUM(amount) as amount
FROM transactions
WHERE type = 'out'
UNION ALL
SELECT 
  'Total Expenses' as metric,
  SUM(amount) as amount
FROM transactions
WHERE type = 'expense'
UNION ALL
SELECT 
  'Calculated Balance (In - Out - Expense)' as metric,
  (SELECT SUM(amount) FROM transactions WHERE type = 'in') -
  (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'out') -
  (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'expense') as amount;

-- 7. Check if gross vs net salary is the issue
SELECT 
  SUM(gross_salary) as total_gross,
  SUM(net_salary) as total_net,
  SUM(gross_salary - net_salary) as total_deductions,
  COUNT(*) as payslip_count
FROM payslips;

-- 8. Monthly breakdown to find where discrepancy started
SELECT 
  DATE_TRUNC('month', date::date) as month,
  type,
  COUNT(*) as count,
  SUM(amount) as total
FROM transactions
GROUP BY DATE_TRUNC('month', date::date), type
ORDER BY month DESC, type;
