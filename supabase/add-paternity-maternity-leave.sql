-- Add paternity and maternity leave types to leave_requests table
-- This allows tracking of paternity and maternity leave requests

-- Update the check constraint to include new leave types
ALTER TABLE leave_requests 
DROP CONSTRAINT IF EXISTS leave_requests_leave_type_check;

ALTER TABLE leave_requests 
ADD CONSTRAINT leave_requests_leave_type_check 
CHECK (leave_type IN ('sick', 'vacation', 'birthday', 'emergency', 'unpaid', 'paternity', 'maternity'));

-- Verify the changes
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'leave_requests' 
  AND column_name = 'leave_type';

-- Show sample data
SELECT id, employee_id, leave_type, start_date, end_date, days_count, status 
FROM leave_requests 
ORDER BY created_at DESC
LIMIT 5;
