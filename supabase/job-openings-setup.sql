-- Job Openings Setup
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS job_openings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  title text NOT NULL,
  department text,
  employment_type text CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'internship')),
  location text,
  salary_min numeric,
  salary_max numeric,
  description text,
  requirements text,
  responsibilities text,
  status text DEFAULT 'open' CHECK (status IN ('open', 'closed', 'on_hold')),
  posted_by text,
  deadline date,
  slots integer DEFAULT 1
);

ALTER TABLE job_openings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON job_openings
  FOR ALL USING (auth.role() = 'authenticated');
