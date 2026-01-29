-- Migration: Equipment Rates
-- Creates master_equipment_rates table for supplier + equipment rate combinations
-- Updates expense_equipment table with supplier columns

-- Create master_equipment_rates table
CREATE TABLE IF NOT EXISTS master_equipment_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  equipment_id UUID NOT NULL REFERENCES master_equipment(id),
  rate DECIMAL(10,2) NOT NULL DEFAULT 0,      -- Daily rate in INR
  daily_hours DECIMAL(4,2) NOT NULL DEFAULT 8, -- Working hours per day
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supplier_id, equipment_id)  -- One rate per supplier+equipment combo
);

-- Indexes for master_equipment_rates
CREATE INDEX IF NOT EXISTS idx_equipment_rates_supplier ON master_equipment_rates(supplier_id);
CREATE INDEX IF NOT EXISTS idx_equipment_rates_equipment ON master_equipment_rates(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_rates_active ON master_equipment_rates(is_active);

-- Trigger for updated_at on master_equipment_rates
CREATE OR REPLACE FUNCTION update_equipment_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_equipment_rates_updated_at ON master_equipment_rates;
CREATE TRIGGER update_equipment_rates_updated_at
  BEFORE UPDATE ON master_equipment_rates
  FOR EACH ROW EXECUTE FUNCTION update_equipment_rates_updated_at();

-- RLS Policy for master_equipment_rates
ALTER TABLE master_equipment_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on master_equipment_rates" ON master_equipment_rates;
CREATE POLICY "Allow all operations on master_equipment_rates"
  ON master_equipment_rates FOR ALL USING (true) WITH CHECK (true);

-- Add supplier columns to expense_equipment table
ALTER TABLE expense_equipment
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id),
ADD COLUMN IF NOT EXISTS supplier_name TEXT;

-- Create index for supplier lookup on expense_equipment
CREATE INDEX IF NOT EXISTS idx_expense_equipment_supplier ON expense_equipment(supplier_id);
