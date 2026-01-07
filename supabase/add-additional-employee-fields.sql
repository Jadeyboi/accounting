-- Add additional important employee fields
-- Run this in Supabase SQL Editor

ALTER TABLE public.employees
  -- Personal Information
  ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT 'Filipino',
  ADD COLUMN IF NOT EXISTS religion TEXT,
  ADD COLUMN IF NOT EXISTS place_of_birth TEXT,
  
  -- Education
  ADD COLUMN IF NOT EXISTS highest_education TEXT CHECK (highest_education IN ('elementary', 'high_school', 'vocational', 'college', 'masters', 'doctorate')),
  ADD COLUMN IF NOT EXISTS school_graduated TEXT,
  ADD COLUMN IF NOT EXISTS course_degree TEXT,
  
  -- Work Information
  ADD COLUMN IF NOT EXISTS job_level TEXT CHECK (job_level IN ('entry', 'junior', 'senior', 'lead', 'manager', 'director', 'executive')),
  ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES public.employees(id),
  ADD COLUMN IF NOT EXISTS work_schedule TEXT DEFAULT '8:00 AM - 5:00 PM',
  ADD COLUMN IF NOT EXISTS work_location TEXT DEFAULT 'Office',
  
  -- Contract Information
  ADD COLUMN IF NOT EXISTS contract_type TEXT CHECK (contract_type IN ('permanent', 'contractual', 'project_based', 'part_time')) DEFAULT 'permanent',
  ADD COLUMN IF NOT EXISTS contract_end_date DATE,
  
  -- Health & Safety
  ADD COLUMN IF NOT EXISTS blood_type TEXT CHECK (blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  ADD COLUMN IF NOT EXISTS medical_conditions TEXT,
  ADD COLUMN IF NOT EXISTS allergies TEXT,
  
  -- Additional Contact
  ADD COLUMN IF NOT EXISTS personal_email TEXT,
  ADD COLUMN IF NOT EXISTS alternate_phone TEXT,
  
  -- Family Information (for benefits)
  ADD COLUMN IF NOT EXISTS spouse_name TEXT,
  ADD COLUMN IF NOT EXISTS spouse_occupation TEXT,
  ADD COLUMN IF NOT EXISTS number_of_children INTEGER DEFAULT 0,
  
  -- Professional
  ADD COLUMN IF NOT EXISTS professional_license TEXT,
  ADD COLUMN IF NOT EXISTS license_expiry DATE,
  ADD COLUMN IF NOT EXISTS certifications TEXT,
  
  -- System fields
  ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS employees_nationality_idx ON public.employees(nationality);
CREATE INDEX IF NOT EXISTS employees_job_level_idx ON public.employees(job_level);
CREATE INDEX IF NOT EXISTS employees_supervisor_id_idx ON public.employees(supervisor_id);
CREATE INDEX IF NOT EXISTS employees_contract_type_idx ON public.employees(contract_type);
CREATE INDEX IF NOT EXISTS employees_blood_type_idx ON public.employees(blood_type);
CREATE INDEX IF NOT EXISTS employees_last_updated_idx ON public.employees(last_updated);

-- Add trigger to update last_updated timestamp
CREATE OR REPLACE FUNCTION update_employees_last_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS employees_last_updated_trigger ON public.employees;
CREATE TRIGGER employees_last_updated_trigger
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION update_employees_last_updated();

-- Comments for documentation
COMMENT ON COLUMN public.employees.nationality IS 'Employee nationality (default: Filipino)';
COMMENT ON COLUMN public.employees.religion IS 'Employee religion (optional)';
COMMENT ON COLUMN public.employees.place_of_birth IS 'Employee place of birth';
COMMENT ON COLUMN public.employees.highest_education IS 'Highest educational attainment';
COMMENT ON COLUMN public.employees.school_graduated IS 'School or university graduated from';
COMMENT ON COLUMN public.employees.course_degree IS 'Course or degree completed';
COMMENT ON COLUMN public.employees.job_level IS 'Job level/seniority';
COMMENT ON COLUMN public.employees.supervisor_id IS 'Direct supervisor/manager employee ID';
COMMENT ON COLUMN public.employees.work_schedule IS 'Work schedule (e.g., 8:00 AM - 5:00 PM)';
COMMENT ON COLUMN public.employees.work_location IS 'Primary work location';
COMMENT ON COLUMN public.employees.contract_type IS 'Type of employment contract';
COMMENT ON COLUMN public.employees.contract_end_date IS 'Contract end date (for contractual employees)';
COMMENT ON COLUMN public.employees.blood_type IS 'Blood type for medical emergencies';
COMMENT ON COLUMN public.employees.medical_conditions IS 'Known medical conditions';
COMMENT ON COLUMN public.employees.allergies IS 'Known allergies';
COMMENT ON COLUMN public.employees.personal_email IS 'Personal email address';
COMMENT ON COLUMN public.employees.alternate_phone IS 'Alternate phone number';
COMMENT ON COLUMN public.employees.spouse_name IS 'Spouse name (for benefits)';
COMMENT ON COLUMN public.employees.spouse_occupation IS 'Spouse occupation';
COMMENT ON COLUMN public.employees.number_of_children IS 'Number of children (for benefits)';
COMMENT ON COLUMN public.employees.professional_license IS 'Professional license number';
COMMENT ON COLUMN public.employees.license_expiry IS 'Professional license expiry date';
COMMENT ON COLUMN public.employees.certifications IS 'Professional certifications';
COMMENT ON COLUMN public.employees.profile_picture_url IS 'URL to profile picture';
COMMENT ON COLUMN public.employees.notes IS 'Additional notes about the employee';
COMMENT ON COLUMN public.employees.last_updated IS 'Timestamp of last record update';