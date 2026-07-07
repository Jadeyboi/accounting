-- RBAC: Add 'employee' role + link users to employee records
-- Run this in Supabase SQL Editor

-- 1. Expand role constraint to include 'employee'
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin', 'admin', 'hr', 'employee', 'user'));

-- 2. Add employee_id FK to users table (links a user account to an employee record)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS users_employee_id_idx ON public.users(employee_id);

-- 3. RLS policy: employees can only read their OWN payslips
--    (Enforced on backend — anon/authenticated still uses existing open policy during transition.
--     Tighten below once employee_id is populated in users table.)

-- Drop and recreate payslips select policy so employees only see their own rows
DROP POLICY IF EXISTS "payslips_select_all" ON public.payslips;

CREATE POLICY "payslips_select_all" ON public.payslips
  FOR SELECT USING (
    -- Super admin, admin, hr, user roles see everything
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin', 'hr', 'user')
    )
    OR
    -- Employee role sees only their own payslips (via employee_id linked in users)
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role = 'employee'
        AND employee_id = public.payslips.employee_id
    )
  );

-- 4. RLS policy: employees can only read their OWN leave requests
DROP POLICY IF EXISTS "leave_requests_select_all" ON public.leave_requests;

-- First ensure RLS is on leave_requests
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_requests_select_all" ON public.leave_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin', 'hr', 'user')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role = 'employee'
        AND employee_id = public.leave_requests.employee_id
    )
  );

-- 5. RLS policy: employees can INSERT their own leave requests only
DROP POLICY IF EXISTS "leave_requests_insert_employee" ON public.leave_requests;
CREATE POLICY "leave_requests_insert_employee" ON public.leave_requests
  FOR INSERT WITH CHECK (
    -- Admins/HR can insert for anyone
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin', 'hr', 'user')
    )
    OR
    -- Employee can only insert for their own employee_id
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role = 'employee'
        AND employee_id = public.leave_requests.employee_id
    )
  );

-- 6. RLS policy: employees can UPDATE (cancel) only their own PENDING leave requests
DROP POLICY IF EXISTS "leave_requests_update_employee" ON public.leave_requests;
CREATE POLICY "leave_requests_update_employee" ON public.leave_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin', 'hr', 'user')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role = 'employee'
        AND employee_id = public.leave_requests.employee_id
        AND public.leave_requests.status = 'pending'
    )
  );

-- Keep existing write-all policies for other tables (admins/HR still need full access)
-- The payslips write policy stays open for admin/HR
-- Employees never write to payslips directly

-- 7. Grant usage on users table for authenticated reads (needed by RLS checks above)
GRANT SELECT ON public.users TO authenticated;
