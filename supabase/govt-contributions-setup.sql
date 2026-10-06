-- ============================================================
-- Government Contributions set-aside in Savings
-- Run this in the Supabase SQL editor.
-- ============================================================

-- 1. Add linkage + metadata columns to savings
--    payslip_id  — ties a row to the payslip that created it (dedup key)
--    notes       — JSON breakdown: { sss, pagibig, philhealth, tax?, period, employee }
--    source      — 'manual' | 'payroll_ec' | 'payroll_er'
ALTER TABLE public.savings
  ADD COLUMN IF NOT EXISTS payslip_id  uuid REFERENCES public.payslips(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS source      text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS notes       jsonb;

-- If the FK was previously created with ON DELETE SET NULL, replace it with CASCADE
DO $$
DECLARE
  _con text;
BEGIN
  SELECT tc.constraint_name INTO _con
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu USING (constraint_name, constraint_schema)
   WHERE tc.table_name = 'savings'
     AND kcu.column_name = 'payslip_id'
     AND tc.constraint_type = 'FOREIGN KEY'
   LIMIT 1;
  IF _con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.savings DROP CONSTRAINT %I', _con);
    ALTER TABLE public.savings
      ADD CONSTRAINT savings_payslip_id_fkey
      FOREIGN KEY (payslip_id) REFERENCES public.payslips(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Unique constraint so we never double-insert for the same payslip+category
CREATE UNIQUE INDEX IF NOT EXISTS savings_payslip_source_uidx
  ON public.savings(payslip_id, source)
  WHERE payslip_id IS NOT NULL;

-- 2. Government remittances — Mark as Remitted
CREATE TABLE IF NOT EXISTS public.govt_remittances (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  category       text NOT NULL,          -- 'EC' | 'ER'
  agency         text NOT NULL,          -- 'SSS' | 'PAGIBIG' | 'PHILHEALTH' | 'BIR'
  coverage_month text NOT NULL,          -- YYYY-MM
  remitted_date  date NOT NULL,
  reference      text,
  amount         numeric(12,2) NOT NULL CHECK (amount > 0),
  notes          text
);

CREATE INDEX IF NOT EXISTS govt_remittances_category_idx ON public.govt_remittances(category, agency, coverage_month);

-- 3. RLS (match the permissive pattern used on other tables)
ALTER TABLE public.govt_remittances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all operations for govt_remittances" ON public.govt_remittances;
CREATE POLICY "Enable all operations for govt_remittances"
  ON public.govt_remittances FOR ALL USING (true) WITH CHECK (true);
-- 4. Cleanup: remove orphaned government set-aside rows whose payslip
--    no longer exists (e.g. created before this migration, or whose
--    payslip_id was nulled by the old ON DELETE SET NULL rule).
DELETE FROM public.savings s
 WHERE s.source IN ('payroll_ec', 'payroll_er')
   AND (
        s.payslip_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.payslips p WHERE p.id = s.payslip_id)
   );
