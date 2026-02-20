-- Setup Receipts Storage Bucket
-- This script creates and configures the receipts storage bucket for file uploads

-- Note: Storage buckets are created through the Supabase Dashboard UI, not SQL
-- Go to: Storage → Create bucket → name: "receipts"
-- Then run the policies below

-- Enable RLS on storage.objects (if not already enabled)
-- This is usually enabled by default in Supabase

-- Create policy to allow authenticated users to upload receipts
CREATE POLICY "Allow authenticated users to upload receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

-- Create policy to allow authenticated users to read receipts
CREATE POLICY "Allow authenticated users to read receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'receipts');

-- Create policy to allow authenticated users to update their receipts
CREATE POLICY "Allow authenticated users to update receipts"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'receipts')
WITH CHECK (bucket_id = 'receipts');

-- Create policy to allow authenticated users to delete receipts
CREATE POLICY "Allow authenticated users to delete receipts"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'receipts');

-- Optional: If you want public read access (not recommended for receipts)
-- CREATE POLICY "Allow public read access to receipts"
-- ON storage.objects
-- FOR SELECT
-- TO public
-- USING (bucket_id = 'receipts');