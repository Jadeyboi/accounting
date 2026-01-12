-- Fix leave_requests table constraint issue
-- This script checks and fixes the leave_type constraint

-- Step 1: Check current constraint
SELECT 
  constraint_name,
  check_clause
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%leave_type%' 
AND constraint_schema = 'public';

-- Step 2: Check current table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'leave_requests' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 3: Drop existing constraint if it exists
ALTER TABLE public.leave_requests 
DROP CONSTRAINT IF EXISTS leave_requests_leave_type_check;

-- Step 4: Add the correct constraint with all valid leave types
ALTER TABLE public.leave_requests 
ADD CONSTRAINT leave_requests_leave_type_check 
CHECK (leave_type IN ('sick', 'vacation', 'birthday', 'emergency', 'unpaid'));

-- Step 5: Check if there are any existing records with invalid leave_type values
SELECT 
  leave_type,
  COUNT(*) as count
FROM public.leave_requests 
GROUP BY leave_type
ORDER BY leave_type;

-- Step 6: Show any records that would violate the constraint
SELECT 
  id,
  leave_type,
  created_at
FROM public.leave_requests 
WHERE leave_type NOT IN ('sick', 'vacation', 'birthday', 'emergency', 'unpaid');

-- Step 7: Verify the constraint is working
SELECT 
  constraint_name,
  check_clause
FROM information_schema.check_constraints 
WHERE constraint_name = 'leave_requests_leave_type_check' 
AND constraint_schema = 'public';