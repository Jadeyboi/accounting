-- =====================================================================
-- PHASE 4: Auto-transfer approved payroll costs into Project P&L.
--
-- For each payslip, distribute its employee cost components to the
-- allocated project(s) as 'auto_payroll' project_transactions.
--
-- SAFETY / dedupe:
--  * Uses the unique index uq_ptx_auto_payroll (payslip_id, project_id,
--    category, month, source='auto_payroll') from Phase 3.
--  * Re-running for a payslip first DELETES its prior auto_payroll rows,
--    then re-inserts — so corrections update rather than duplicate.
--  * Skips projects that are completed/cancelled (archived) unless active.
--  * Only touches source='auto_payroll' rows; manual entries untouched.
-- =====================================================================

-- Post (or re-post) one payslip's costs to its allocated projects.
CREATE OR REPLACE FUNCTION post_payslip_to_projects(p_payslip_id uuid, p_actor text DEFAULT 'system')
RETURNS jsonb AS $$
DECLARE
  ps RECORD;
  alloc RECORD;
  v_month text;
  v_rows int := 0;
  v_components jsonb;
  comp RECORD;
  v_proj_status text;
BEGIN
  SELECT * INTO ps FROM payslips WHERE id = p_payslip_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'payslip not found'); END IF;

  -- reporting month from period_end (fallback date_issued)
  v_month := to_char(COALESCE(ps.period_end, ps.date_issued)::date, 'YYYY-MM');

  -- Remove prior auto rows for this payslip (idempotent correction)
  DELETE FROM project_transactions WHERE payslip_id = p_payslip_id AND source = 'auto_payroll';

  -- Cost components (employer-side + gross pay items). Amounts are peso.
  -- We treat these as project EXPENSE (kind='expense'), auto-approved.
  v_components := jsonb_build_object(
    'Basic / Gross Salary', COALESCE(ps.gross_salary, 0),
    'Allowances',           COALESCE(ps.allowances, 0),
    'Holiday Pay',          COALESCE(ps.holiday_pay, 0),
    'Bonuses',              COALESCE(ps.bonuses, 0),
    'Employer SSS',         COALESCE(ps.sss, 0),
    'Employer PhilHealth',  COALESCE(ps.philhealth, 0),
    'Employer Pag-IBIG',    COALESCE(ps.pagibig, 0)
  );

  -- For each allocation line on this payslip
  FOR alloc IN
    SELECT project_id, allocation_pct FROM payslip_project_allocations WHERE payslip_id = p_payslip_id
  LOOP
    SELECT status INTO v_proj_status FROM projects WHERE id = alloc.project_id;
    IF v_proj_status IN ('completed', 'cancelled') THEN
      CONTINUE; -- do not post to archived/closed projects
    END IF;

    FOR comp IN SELECT * FROM jsonb_each_text(v_components) LOOP
      IF (comp.value)::numeric <> 0 THEN
        INSERT INTO project_transactions
          (project_id, kind, category, description, txn_date, month, currency, exchange_rate,
           amount, amount_php, status, source, payslip_id, created_by, approved_by, approved_at)
        VALUES
          (alloc.project_id, 'expense', comp.key,
           'Auto payroll: ' || comp.key,
           COALESCE(ps.date_issued, CURRENT_DATE), v_month, 'PHP', 1,
           ROUND((comp.value)::numeric * alloc.allocation_pct / 100, 2),
           ROUND((comp.value)::numeric * alloc.allocation_pct / 100, 2),
           'approved', 'auto_payroll', p_payslip_id, p_actor, p_actor, now());
        v_rows := v_rows + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('rows', v_rows, 'month', v_month);
END;
$$ LANGUAGE plpgsql;

-- Bulk: post all payslips for a given YYYY-MM month (used by a "Sync" button).
CREATE OR REPLACE FUNCTION post_month_payroll_to_projects(p_month text, p_actor text DEFAULT 'system')
RETURNS jsonb AS $$
DECLARE r RECORD; v_total int := 0; v_res jsonb;
BEGIN
  FOR r IN
    SELECT id FROM payslips
    WHERE to_char(COALESCE(period_end, date_issued)::date, 'YYYY-MM') = p_month
  LOOP
    v_res := post_payslip_to_projects(r.id, p_actor);
    v_total := v_total + COALESCE((v_res->>'rows')::int, 0);
  END LOOP;
  RETURN jsonb_build_object('rows', v_total, 'month', p_month);
END;
$$ LANGUAGE plpgsql;
