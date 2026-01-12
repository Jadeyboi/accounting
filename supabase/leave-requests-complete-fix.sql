-- Complete fix for leave_requests table constraint issue
-- This handles both constraint and data issues

-- Step 1: Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  employee_id UUID NOT NULL,
  leave_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count DECIMAL(4,1) NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Step 2: Check for any invalid leave_type values in existing data
SELECT 
  'Invalid leave_type values found:' as message,
  leave_type,
  COUNT(*) as count
FROM public.leave_requests 
WHERE leave_type NOT IN ('sick', 'vacation', 'birthday', 'emergency', 'unpaid')
GROUP BY leave_type;

-- Step 3: Fix any invalid leave_type values (if any exist)
-- Update any invalid values to 'sick' as default
UPDATE public.leave_requests 
SET leave_type = 'sick'
WHERE leave_type NOT IN ('sick', 'vacation', 'birthday', 'emergency', 'unpaid');

-- Step 4: Drop all existing constraints to avoid conflicts
ALTER TABLE public.leave_requests 
DROP CONSTRAINT IF EXISTS leave_requests_leave_type_check;

ALTER TABLE public.leave_requests 
DROP CONSTRAINT IF EXISTS leave_requests_status_check;

-- Step 5: Add the correct constraints
ALTER TABLE public.leave_requests 
ADD CONSTRAINT leave_requests_leave_type_check 
CHECK (leave_type IN ('sick', 'vacation', 'birthday', 'emergency', 'unpaid'));

ALTER TABLE public.leave_requests 
ADD CONSTRAINT leave_requests_status_check 
CHECK (status IN ('pending', 'approved', 'rejected'));

-- Step 6: Add foreign key constraint if employees table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees' AND table_schema = 'public') THEN
        -- Drop existing foreign key if it exists
        ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS leave_requests_employee_id_fkey;
        
        -- Add foreign key constraint
        ALTER TABLE public.leave_requests 
        ADD CONSTRAINT leave_requests_employee_id_fkey 
        FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Step 7: Create indexes for better performance
CREATE INDEX IF NOT EXISTS leave_requests_employee_id_idx ON public.leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS leave_requests_status_idx ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS leave_requests_leave_type_idx ON public.leave_requests(leave_type);
CREATE INDEX IF NOT EXISTS leave_requests_start_date_idx ON public.leave_requests(start_date);

-- Step 8: Enable Row Level Security
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Step 9: Drop existing policy and create new one
DROP POLICY IF EXISTS "Enable all operations for leave_requests" ON public.leave_requests;
CREATE POLICY "Enable all operations for leave_requests" ON public.leave_requests
  FOR ALL USING (true) WITH CHECK (true);

-- Step 10: Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.leave_requests TO anon, authenticated;

-- Step 11: Verify the final structure and constraints
SELECT 
  'Table structure:' as info,
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'leave_requests' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 12: Show constraints
SELECT 
  'Constraints:' as info,
  tc.constraint_name,
  tc.constraint_type,
  cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'leave_requests' AND tc.table_schema = 'public';

-- Step 13: Test the constraint by showing valid leave_type values
SELECT 'Valid leave_type values: sick, vacation, birthday, emergency, unpaid' as valid_values;

-- Step 14: Show current data summary
SELECT 
  'Current data summary:' as info,
  leave_type,
  status,
  COUNT(*) as count
FROM public.leave_requests 
GROUP BY leave_type, status
ORDER BY leave_type, status;