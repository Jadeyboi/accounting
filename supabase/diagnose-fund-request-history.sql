-- Diagnostic script for Fund Request History database issues
-- Run this to check if tables exist and have data

-- Check 1: Do the tables exist?
SELECT 
  'Tables exist check:' as info,
  table_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'fund_request_history' AND table_schema = 'public'
  ) THEN 'YES' ELSE 'NO' END as fund_request_history_exists,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'fund_request_groups' AND table_schema = 'public'
  ) THEN 'YES' ELSE 'NO' END as fund_request_groups_exists
FROM information_schema.tables 
WHERE table_name IN ('fund_request_history', 'fund_request_groups') 
AND table_schema = 'public';

-- Check 2: What's the table structure?
SELECT 
  'Table structure:' as info,
  table_name,
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name IN ('fund_request_history', 'fund_request_groups') 
AND table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- Check 3: How many records are in each table?
SELECT 
  'Record counts:' as info,
  (SELECT COUNT(*) FROM public.fund_request_history) as history_count,
  (SELECT COUNT(*) FROM public.fund_request_groups) as groups_count;

-- Check 4: Show sample history records
SELECT 
  'Sample history records:' as info,
  id,
  period,
  period_label,
  total_amount,
  usd_rate,
  created_at
FROM public.fund_request_history 
ORDER BY created_at DESC 
LIMIT 5;

-- Check 5: Show sample group records  
SELECT 
  'Sample group records:' as info,
  id,
  name,
  created_at
FROM public.fund_request_groups 
ORDER BY created_at DESC 
LIMIT 5;

-- Check 6: Check RLS policies
SELECT 
  'RLS policies:' as info,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('fund_request_history', 'fund_request_groups');

-- Check 7: Check permissions
SELECT 
  'Table permissions:' as info,
  table_name,
  privilege_type,
  grantee
FROM information_schema.table_privileges 
WHERE table_name IN ('fund_request_history', 'fund_request_groups')
AND table_schema = 'public';