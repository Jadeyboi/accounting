-- Add photo_url column to employees table
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Create the storage bucket for employee photos (run once)
-- Go to Supabase Dashboard > Storage > New bucket
-- Name: employee-photos
-- Public bucket: YES (so photos are publicly accessible via URL)

-- Storage RLS policies for employee-photos bucket
-- Allow authenticated users to upload/update photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-photos', 'employee-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "authenticated can upload employee photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'employee-photos');

-- Allow authenticated users to update (upsert)
CREATE POLICY "authenticated can update employee photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'employee-photos');

-- Allow public read access
CREATE POLICY "public can read employee photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'employee-photos');

-- Allow authenticated users to delete photos
CREATE POLICY "authenticated can delete employee photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'employee-photos');
