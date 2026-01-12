-- Simple diagnostic for leave_requests constraint issue
-- Avoids complex joins that can cause ambiguous column errors

-- Check 1: Does the table exist?
SELECT 'Table exists: ' || 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'leave_requests' AND table_schema = 'public'
  ) THEN 'YES' ELSE 'NO' END as result;

-- Check 2: What constraints exist on the table?
SELECT 
  constraint_name,
  constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'leave_requests' AND table_schema = 'public'
ORDER BY constraint_name;

-- Check 3: What's the leave_type constraint specifically?
SELECT 
  constraint_name,
  check_clause
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%leave_type%' 
AND constraint_schema = 'public';

-- Check 4: What leave_type values exist in the data?
SELECT 
  'Existing leave_type values:' as info,
  leave_type,
  COUNT(*) as count
FROM public.leave_requests 
GROUP BY leave_type
ORDER BY leave_type;

-- Check 5: Are there any problematic values?
SELECT 
  'Checking for invalid values...' as info,
  COUNT(*) as invalid_count
FROM public.leave_requests 
WHERE leave_type NOT IN ('sick', 'vacation', 'birthday', 'emergency', 'unpaid');

-- Check 6: Show any invalid values if they exist
SELECT 
  'Invalid leave_type values found:' as info,
  leave_type,
  COUNT(*) as count
FROM public.leave_requests 
WHERE leave_type NOT IN ('sick', 'vacation', 'birthday', 'emergency', 'unpaid')
GROUP BY leave_type;

-- Check 7: Sample of recent records
SELECT 
  'Recent records:' as info,
  id,
  leave_type,
  status,
  created_at
FROM public.leave_requests 
ORDER BY created_at DESC 
LIMIT 3;