-- ============================================================
-- Configurable statutory rates (SSS, Pag-IBIG, PhilHealth)
-- Effective-dated. The app loads the most recent schedule whose
-- effective_date <= today and overrides the built-in 2025 defaults.
-- Run this in the Supabase SQL editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.statutory_rates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  effective_date date NOT NULL,
  -- Full rate schedule as JSON, matching the StatutoryRates shape in
  -- src/lib/statutoryDeductions.ts (sss, pagibig, philhealth).
  config         jsonb NOT NULL,
  notes          text
);

CREATE UNIQUE INDEX IF NOT EXISTS statutory_rates_effective_uidx
  ON public.statutory_rates(effective_date);

ALTER TABLE public.statutory_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all operations for statutory_rates" ON public.statutory_rates;
CREATE POLICY "Enable all operations for statutory_rates"
  ON public.statutory_rates FOR ALL USING (true) WITH CHECK (true);

-- Seed the current 2025 schedule (matches the app's built-in default).
-- Safe to re-run: upsert on effective_date.
INSERT INTO public.statutory_rates (effective_date, config, notes)
VALUES (
  '2025-01-01',
  '{
    "effectiveDate": "2025-01-01",
    "sss": { "employeeRate": 0.05, "employerRate": 0.10, "mscFloor": 5000, "mscCeiling": 35000, "mscStep": 500, "mscBase": 5500, "mscBaseSalary": 5250, "ecLowAmount": 10, "ecHighAmount": 30, "ecThreshold": 14500 },
    "pagibig": { "lowRate": 0.01, "highRate": 0.02, "lowThreshold": 1500, "fundSalaryCap": 10000, "employerRate": 0.02 },
    "philhealth": { "rate": 0.025, "salaryFloor": 10000, "salaryCeiling": 100000 }
  }'::jsonb,
  'Default 2025 schedule (seeded by migration).'
)
ON CONFLICT (effective_date) DO NOTHING;
