-- Simple fix for leave_requests constraint issue
-- Just fixes the constraint without complex queries

-- Step 1: Drop the problematic constraint
ALTER TABLE public.leave_requests 
DROP CONSTRAINT IF EXISTS leave_requests_leave_type_check;

-- Step 2: Add the correct constraint
ALTER TABLE public.leave_requests 
ADD CONSTRAINT leave_requests_leave_type_check 
CHECK (leave_type IN ('sick', 'vacation', 'birthday', 'emergency', 'unpaid'));

-- Step 3: Also fix status constraint while we're at it
ALTER TABLE public.leave_requests 
DROP CONSTRAINT IF EXISTS leave_requests_status_check;

ALTER TABLE public.leave_requests 
ADD CONSTRAINT leave_requests_status_check 
CHECK (status IN ('pending', 'approved', 'rejected'));

-- Step 4: Verify the constraints were created
SELECT 
  constraint_name,
  check_clause
FROM information_schema.check_constraints 
WHERE constraint_schema = 'public' 
AND constraint_name LIKE '%leave_requests%'
ORDER BY constraint_name;

-- Success message
SELECT 'Leave requests constraints have been fixed!' as status;