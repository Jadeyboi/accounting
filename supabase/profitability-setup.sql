-- Profitability Monitoring Module
-- Run this in your Supabase SQL editor

-- Clients
CREATE TABLE IF NOT EXISTS pm_clients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  name text NOT NULL,
  contract_start_date date,
  monthly_revenue numeric DEFAULT 0,
  contract_value numeric DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes text
);

-- Projects
CREATE TABLE IF NOT EXISTS pm_projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  client_id uuid NOT NULL REFERENCES pm_clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date,
  end_date date,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
  monthly_revenue_target numeric DEFAULT 0,
  notes text
);

-- Monthly Revenue per Project
CREATE TABLE IF NOT EXISTS pm_revenues (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  project_id uuid NOT NULL REFERENCES pm_projects(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES pm_clients(id) ON DELETE CASCADE,
  month text NOT NULL, -- YYYY-MM
  amount numeric DEFAULT 0,
  notes text
);

-- Employee Costs per Project per Month
CREATE TABLE IF NOT EXISTS pm_employee_costs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  project_id uuid NOT NULL REFERENCES pm_projects(id) ON DELETE CASCADE,
  month text NOT NULL, -- YYYY-MM
  employee_name text NOT NULL,
  position text,
  basic_salary numeric DEFAULT 0,
  sss numeric DEFAULT 0,
  philhealth numeric DEFAULT 0,
  pagibig numeric DEFAULT 0,
  ot_pay numeric DEFAULT 0,
  night_differential numeric DEFAULT 0,
  incentives numeric DEFAULT 0,
  other_costs numeric DEFAULT 0
  -- total_cost computed in app: sum of all cost fields
);

-- Expenses
CREATE TABLE IF NOT EXISTS pm_expenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  month text NOT NULL, -- YYYY-MM
  category text NOT NULL CHECK (category IN (
    'recruitment', 'software', 'equipment', 'internet',
    'office', 'training', 'miscellaneous'
  )),
  amount numeric DEFAULT 0,
  description text,
  scope text DEFAULT 'company' CHECK (scope IN ('project', 'client', 'company')),
  project_id uuid REFERENCES pm_projects(id) ON DELETE SET NULL,
  client_id uuid REFERENCES pm_clients(id) ON DELETE SET NULL
);

-- Enable RLS on all tables
ALTER TABLE pm_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_revenues ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_employee_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all authenticated" ON pm_clients FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated" ON pm_projects FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated" ON pm_revenues FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated" ON pm_employee_costs FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow all authenticated" ON pm_expenses FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pm_projects_client ON pm_projects(client_id);
CREATE INDEX IF NOT EXISTS idx_pm_revenues_project ON pm_revenues(project_id);
CREATE INDEX IF NOT EXISTS idx_pm_revenues_month ON pm_revenues(month);
CREATE INDEX IF NOT EXISTS idx_pm_employee_costs_project ON pm_employee_costs(project_id);
CREATE INDEX IF NOT EXISTS idx_pm_employee_costs_month ON pm_employee_costs(month);
CREATE INDEX IF NOT EXISTS idx_pm_expenses_month ON pm_expenses(month);
