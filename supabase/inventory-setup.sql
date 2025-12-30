-- Create inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL, -- e.g., pcs, box, pack, etc.
  unit_price DECIMAL(10, 2) DEFAULT 0,
  total_value DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  location TEXT, -- where the item is stored
  supplier TEXT,
  minimum_stock INTEGER DEFAULT 0, -- alert when stock is below this
  notes TEXT,
  last_restocked DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create inventory transactions table (for tracking stock movements)
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL, -- 'in' (stock in) or 'out' (stock out)
  quantity INTEGER NOT NULL,
  reason TEXT, -- e.g., "Purchase", "Usage", "Damaged", "Return"
  performed_by TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);
CREATE INDEX IF NOT EXISTS idx_inventory_item_name ON inventory(item_name);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_inventory_id ON inventory_transactions(inventory_id);

-- Enable RLS
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all operations for authenticated users)
CREATE POLICY "Enable all operations for inventory" ON inventory
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all operations for inventory_transactions" ON inventory_transactions
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
