-- Remove the foreign key constraint that blocks user creation
-- The users table should be manageable independently
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- Also ensure the required columns exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name text;
