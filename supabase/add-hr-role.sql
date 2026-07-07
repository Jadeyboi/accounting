-- Allow 'hr' as a valid role in the users table
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('super_admin', 'admin', 'hr', 'user'));
