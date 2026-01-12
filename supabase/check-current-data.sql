-- Check what's actually in the fund_request_history table
SELECT 
  'Current records in database:' as info,
  id,
  period,
  period_label,
  items,
  total_amount,
  created_at
FROM public.fund_request_history 
ORDER BY created_at DESC;