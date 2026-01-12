-- Fund Request History Database Setup
-- This moves fund request history from localStorage to database for cross-device access

-- Create fund_request_history table
CREATE TABLE IF NOT EXISTS public.fund_request_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  period TEXT NOT NULL, -- e.g., "2024-01" for January 2024
  period_label TEXT NOT NULL, -- e.g., "January 2024"
  items JSONB NOT NULL, -- Array of request items
  total_monthly DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_half_month DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_one_time DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  usd_rate DECIMAL(8,4) NOT NULL DEFAULT 56.0,
  notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create fund_request_groups table for saved groups
CREATE TABLE IF NOT EXISTS public.fund_request_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  items JSONB NOT NULL, -- Array of request items
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS fund_request_history_period_idx ON public.fund_request_history(period);
CREATE INDEX IF NOT EXISTS fund_request_history_created_at_idx ON public.fund_request_history(created_at);
CREATE INDEX IF NOT EXISTS fund_request_groups_name_idx ON public.fund_request_groups(name);
CREATE INDEX IF NOT EXISTS fund_request_groups_created_at_idx ON public.fund_request_groups(created_at);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_fund_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS fund_request_history_updated_at_trigger ON public.fund_request_history;
CREATE TRIGGER fund_request_history_updated_at_trigger
  BEFORE UPDATE ON public.fund_request_history
  FOR EACH ROW
  EXECUTE FUNCTION update_fund_request_updated_at();

DROP TRIGGER IF EXISTS fund_request_groups_updated_at_trigger ON public.fund_request_groups;
CREATE TRIGGER fund_request_groups_updated_at_trigger
  BEFORE UPDATE ON public.fund_request_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_fund_request_updated_at();

-- Enable Row Level Security
ALTER TABLE public.fund_request_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_request_groups ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (adjust based on your auth setup)
DROP POLICY IF EXISTS "Enable all operations for fund_request_history" ON public.fund_request_history;
CREATE POLICY "Enable all operations for fund_request_history" ON public.fund_request_history
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all operations for fund_request_groups" ON public.fund_request_groups;
CREATE POLICY "Enable all operations for fund_request_groups" ON public.fund_request_groups
  FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fund_request_history TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fund_request_groups TO anon, authenticated;

-- Comments for documentation
COMMENT ON TABLE public.fund_request_history IS 'Stores fund request history records for cross-device access';
COMMENT ON COLUMN public.fund_request_history.period IS 'Period identifier in YYYY-MM format';
COMMENT ON COLUMN public.fund_request_history.period_label IS 'Human-readable period label';
COMMENT ON COLUMN public.fund_request_history.items IS 'JSON array of request items with all details';
COMMENT ON COLUMN public.fund_request_history.usd_rate IS 'USD to PHP exchange rate used for calculations';

COMMENT ON TABLE public.fund_request_groups IS 'Stores saved fund request groups for reuse';
COMMENT ON COLUMN public.fund_request_groups.name IS 'User-defined name for the saved group';
COMMENT ON COLUMN public.fund_request_groups.items IS 'JSON array of request items in the group';

-- Show table structure
SELECT 
  table_name,
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name IN ('fund_request_history', 'fund_request_groups') 
AND table_schema = 'public'
ORDER BY table_name, ordinal_position;