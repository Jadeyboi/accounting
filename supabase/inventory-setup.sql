-- Create asset inventory table for office equipment
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_tag TEXT UNIQUE, -- e.g., AVT-PC-001, AVT-MON-002
  item_description TEXT NOT NULL,
  category TEXT NOT NULL, -- e.g., Computer, Monitor, TV, Kitchen Appliance, Peripherals
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  purchase_date DATE,
  purchase_price DECIMAL(10, 2),
  supplier TEXT,
  warranty_expiry DATE,
  assigned_to TEXT, -- employee name or department
  location TEXT, -- where the asset is located
  status TEXT NOT NULL DEFAULT 'active', -- active, under_repair, disposed, lost
  condition TEXT, -- excellent, good, fair, poor
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create asset maintenance/history table
CREATE TABLE IF NOT EXISTS inventory_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'maintenance', 'repair', 'transfer', 'status_change'
  description TEXT NOT NULL,
  performed_by TEXT,
  action_date DATE NOT NULL DEFAULT CURRENT_DATE,
  cost DECIMAL(10, 2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);
CREATE INDEX IF NOT EXISTS idx_inventory_asset_tag ON inventory(asset_tag);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);
CREATE INDEX IF NOT EXISTS idx_inventory_assigned_to ON inventory(assigned_to);
CREATE INDEX IF NOT EXISTS idx_inventory_history_inventory_id ON inventory_history(inventory_id);

-- Enable RLS
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_history ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all operations for authenticated users)
CREATE POLICY "Enable all operations for inventory" ON inventory
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all operations for inventory_history" ON inventory_history
  FOR ALL USING (true) WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS inventory_updated_at_trigger ON inventory;
CREATE TRIGGER inventory_updated_at_trigger
  BEFORE UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_updated_at();
