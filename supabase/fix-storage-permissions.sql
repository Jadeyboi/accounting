-- Fix Storage Permissions for Receipts Bucket
-- This script adds all necessary policies for the receipts bucket to work properly

-- ============================================
-- STEP 1: Allow listing storage buckets
-- ============================================

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow authenticated users to list buckets" ON storage.buckets;
DROP POLICY IF EXISTS "Allow anon to list buckets" ON storage.buckets;

-- Allow authenticated users to list buckets
CREATE POLICY "Allow authenticated users to list buckets"
ON storage.buckets
FOR SELECT
TO authenticated
USING (true);

-- Allow anon users to list buckets (needed for storage check)
CREATE POLICY "Allow anon to list buckets"
ON storage.buckets
FOR SELECT
TO anon
USING (true);

-- ============================================
-- STEP 2: Receipts bucket object policies
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to read receipts" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update receipts" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete receipts" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to receipts" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon read access to receipts" ON storage.objects;

-- Allow authenticated users to upload receipts
CREATE POLICY "Allow authenticated users to upload receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

-- Allow authenticated users to read receipts
CREATE POLICY "Allow authenticated users to read receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'receipts');

-- Allow public/anon users to read receipts (since bucket is public)
CREATE POLICY "Allow public read access to receipts"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'receipts');

-- Allow anon users to read receipts
CREATE POLICY "Allow anon read access to receipts"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'receipts');

-- Allow authenticated users to update receipts
CREATE POLICY "Allow authenticated users to update receipts"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'receipts')
WITH CHECK (bucket_id = 'receipts');

-- Allow authenticated users to delete receipts
CREATE POLICY "Allow authenticated users to delete receipts"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'receipts');

-- ============================================
-- STEP 3: Verify the setup
-- ============================================

-- Check bucket policies
SELECT 
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('buckets', 'objects')
ORDER BY tablename, policyname;

-- List all buckets (should show 'receipts')
SELECT * FROM storage.buckets;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Storage permissions configured successfully!';
  RAISE NOTICE 'Bucket: receipts';
  RAISE NOTICE 'Policies: Created for buckets and objects tables';
  RAISE NOTICE 'Next step: Refresh your app and try uploading a receipt';
END $$;