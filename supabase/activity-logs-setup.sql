-- Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  user_id uuid,
  user_email text,
  action text NOT NULL, -- 'created', 'updated', 'deleted'
  module text NOT NULL, -- 'Payroll', 'HRIS', 'Loans', 'Oakridge', etc.
  description text NOT NULL,
  metadata jsonb -- optional extra data
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON activity_logs
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON activity_logs(module);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
