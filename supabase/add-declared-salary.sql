ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS declared_salary NUMERIC;
