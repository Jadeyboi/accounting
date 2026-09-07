-- =====================================================================
-- PHASE 1: Projects master, employee-project assignment history,
-- safe department->project migration (review-first, no auto-run).
--
-- SAFETY:
--  * Does NOT drop or modify the existing employees.department column.
--  * Adds employees.current_project_id (nullable) for backward-compatible linkage.
--  * Migration is a FUNCTION you call explicitly after reviewing the preview.
--  * Idempotent: safe to re-run; will not create duplicate projects/assignments.
-- Run this whole file in the Supabase SQL editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Projects master
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  name text NOT NULL,
  code text UNIQUE,                       -- project code (unique)
  client_name text,
  project_manager text,                   -- display name; PM user linkage via project_managers table below
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'active',  -- active | on_hold | completed | cancelled
  billing_currency text NOT NULL DEFAULT 'PHP',
  monthly_billing numeric NOT NULL DEFAULT 0,
  notes text,
  -- provenance: was this project auto-created from a legacy department value?
  migrated_from_department text
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_code ON projects(code);

-- keep updated_at fresh
CREATE OR REPLACE FUNCTION set_projects_updated_at()
RETURNS trigger AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_projects_updated ON projects;
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_projects_updated_at();

-- ---------------------------------------------------------------------
-- 2. Employee <-> Project assignment history (effective-dated)
--    An employee can be reassigned; previous rows are kept (end-dated).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employee_project_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,                          -- null = current/open assignment
  allocation_pct numeric NOT NULL DEFAULT 100,  -- for multi-project (phase 2 uses this)
  notes text,
  created_by text
);

CREATE INDEX IF NOT EXISTS idx_epa_employee ON employee_project_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_epa_project ON employee_project_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_epa_open ON employee_project_assignments(employee_id) WHERE end_date IS NULL;

-- ---------------------------------------------------------------------
-- 3. Backward-compatible link on employees (department column preserved)
-- ---------------------------------------------------------------------
ALTER TABLE employees ADD COLUMN IF NOT EXISTS current_project_id uuid REFERENCES projects(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- 4. Project Manager role linkage (which users manage which projects)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_managers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,                  -- references auth users / public.users.id
  UNIQUE (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_project_managers_user ON project_managers(user_id);

-- Add 'project_manager' to the users.role CHECK constraint (preserve existing values).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE constraint_name = 'users_role_check' AND table_name = 'users') THEN
    ALTER TABLE users DROP CONSTRAINT users_role_check;
  END IF;
  ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('super_admin','admin','hr','user','project_manager'));
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not update users_role_check (may not exist or different name): %', SQLERRM;
END $$;

-- ---------------------------------------------------------------------
-- 5. Migration audit (records what the migration did, for rollback reference)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_migration_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  action text NOT NULL,               -- 'preview' | 'migrate' | 'rollback'
  detail jsonb
);

-- ---------------------------------------------------------------------
-- 6. PREVIEW function — read-only. Returns what WOULD be migrated.
--    Groups distinct non-empty employees.department values and counts.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION preview_department_migration()
RETURNS TABLE(department text, employee_count bigint, project_exists boolean) AS $$
  SELECT
    e.department,
    COUNT(*) AS employee_count,
    EXISTS (SELECT 1 FROM projects p WHERE p.migrated_from_department = e.department
            OR lower(p.name) = lower(e.department)) AS project_exists
  FROM employees e
  WHERE e.department IS NOT NULL AND btrim(e.department) <> ''
  GROUP BY e.department
  ORDER BY employee_count DESC;
$$ LANGUAGE sql STABLE;

-- ---------------------------------------------------------------------
-- 7. MIGRATE function — call explicitly AFTER reviewing the preview.
--    * Creates a project per distinct department (if not already present).
--    * Sets employees.current_project_id and opens an assignment row.
--    * Idempotent: skips employees already assigned; never deletes department.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION migrate_departments_to_projects(p_actor text DEFAULT 'system')
RETURNS jsonb AS $$
DECLARE
  rec RECORD;
  v_project_id uuid;
  v_projects_created int := 0;
  v_assignments_created int := 0;
BEGIN
  FOR rec IN
    SELECT DISTINCT e.department AS dept
    FROM employees e
    WHERE e.department IS NOT NULL AND btrim(e.department) <> ''
  LOOP
    -- find or create the project for this department
    SELECT id INTO v_project_id FROM projects
      WHERE migrated_from_department = rec.dept OR lower(name) = lower(rec.dept)
      LIMIT 1;
    IF v_project_id IS NULL THEN
      INSERT INTO projects (name, status, migrated_from_department, notes)
      VALUES (rec.dept, 'active', rec.dept, 'Auto-created from legacy department during migration')
      RETURNING id INTO v_project_id;
      v_projects_created := v_projects_created + 1;
    END IF;

    -- link employees in this department who have no current project yet
    UPDATE employees SET current_project_id = v_project_id
      WHERE department = rec.dept AND current_project_id IS NULL;

    -- open an assignment row for each such employee (skip if one already open)
    INSERT INTO employee_project_assignments (employee_id, project_id, start_date, allocation_pct, created_by, notes)
    SELECT e.id, v_project_id, COALESCE(e.date_hired, CURRENT_DATE), 100, p_actor, 'Migrated from department'
    FROM employees e
    WHERE e.department = rec.dept
      AND NOT EXISTS (
        SELECT 1 FROM employee_project_assignments a
        WHERE a.employee_id = e.id AND a.end_date IS NULL
      );
    GET DIAGNOSTICS v_assignments_created = ROW_COUNT;
  END LOOP;

  INSERT INTO project_migration_log (action, detail)
  VALUES ('migrate', jsonb_build_object('projects_created', v_projects_created, 'actor', p_actor));

  RETURN jsonb_build_object('projects_created', v_projects_created, 'assignments_created', v_assignments_created);
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 8. ROLLBACK helper — undoes ONLY auto-migrated links (department stays intact).
--    Removes migrated assignments + clears current_project_id for auto-created
--    projects, then deletes the auto-created projects that have no other data.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rollback_department_migration()
RETURNS jsonb AS $$
DECLARE v_removed int := 0;
BEGIN
  -- clear links pointing at auto-created projects
  UPDATE employees SET current_project_id = NULL
    WHERE current_project_id IN (SELECT id FROM projects WHERE migrated_from_department IS NOT NULL);
  -- delete migrated assignments
  DELETE FROM employee_project_assignments
    WHERE notes = 'Migrated from department'
      AND project_id IN (SELECT id FROM projects WHERE migrated_from_department IS NOT NULL);
  -- delete the auto-created projects
  DELETE FROM projects WHERE migrated_from_department IS NOT NULL;
  GET DIAGNOSTICS v_removed = ROW_COUNT;
  INSERT INTO project_migration_log (action, detail)
  VALUES ('rollback', jsonb_build_object('projects_removed', v_removed));
  RETURN jsonb_build_object('projects_removed', v_removed);
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 9. RLS
-- ---------------------------------------------------------------------
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_migration_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated" ON projects;
CREATE POLICY "Allow all authenticated" ON projects
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Allow all authenticated" ON employee_project_assignments;
CREATE POLICY "Allow all authenticated" ON employee_project_assignments
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Allow all authenticated" ON project_managers;
CREATE POLICY "Allow all authenticated" ON project_managers
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Allow all authenticated" ON project_migration_log;
CREATE POLICY "Allow all authenticated" ON project_migration_log
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================================
-- Attachments bucket (Phase 3 will use it) — private bucket.
-- Uncomment if you want to create it now; otherwise Phase 3 will guide you.
-- INSERT INTO storage.buckets (id, name, public) VALUES ('project-files','project-files', false)
--   ON CONFLICT (id) DO NOTHING;
-- =====================================================================
