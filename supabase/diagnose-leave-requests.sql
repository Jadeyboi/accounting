-- Diagnostic script for leave_requests table issues
-- Run this to identify the exact problem

-- Check 1: Does the table exist?
SELECT 
  'Table exists:' as check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'leave_requests' AND table_schema = 'public'
  ) THEN 'YES' ELSE 'NO' END as result;

-- Check 2: What are the current constraints?
SELECT 
  'Current constraints:' as check_name,
  tc.constraint_name,
  tc.constraint_type,
  cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'leave_requests' AND tc.table_schema = 'public';

-- Check 3: What leave_type values exist in the data?
SELECT 
  'Existing leave_type values:' as check_name,
  leave_type,
  COUNT(*) as count
FROM public.leave_requests 
GROUP BY leave_type
ORDER BY leave_type;

-- Check 4: Are there any invalid leave_type values?
SELECT 
  'Invalid leave_type values:' as check_name,
  leave_type,
  COUNT(*) as count
FROM public.leave_requests 
WHERE leave_type NOT IN ('sick', 'vacation', 'birthday', 'emergency', 'unpaid')
GROUP BY leave_type;

-- Check 5: What's the exact constraint definition?
SELECT 
  'Leave type constraint definition:' as check_name,
  check_clause
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%leave_type%' 
AND constraint_schema = 'public';

-- Check 6: Sample of recent records
SELECT 
  'Recent records sample:' as check_name,
  id,
  leave_type,
  status,
  created_at
FROM public.leave_requests 
ORDER BY created_at DESC 
LIMIT 5;