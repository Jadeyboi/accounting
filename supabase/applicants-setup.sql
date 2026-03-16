-- Applicants Setup
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS applicants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  job_opening_id uuid REFERENCES job_openings(id) ON DELETE SET NULL,
  -- Personal Info
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  address text,
  -- Application Details
  expected_salary numeric,
  available_start text, -- e.g. "Immediately", "2 weeks", "1 month"
  hybrid_comfortable boolean DEFAULT false,
  cv_url text,
  -- Status tracking
  status text DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'interview', 'offer', 'hired', 'rejected')),
  notes text,
  applied_date date DEFAULT CURRENT_DATE
);

ALTER TABLE applicants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON applicants
  FOR ALL USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_applicants_job_opening_id ON applicants(job_opening_id);

-- Storage bucket for CVs: create manually in Supabase Dashboard → Storage → New bucket → name: "cvs"
-- Then run these policies:
CREATE POLICY "Allow authenticated users to upload cvs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'cvs');

CREATE POLICY "Allow authenticated users to read cvs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'cvs');

CREATE POLICY "Allow authenticated users to delete cvs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'cvs');
