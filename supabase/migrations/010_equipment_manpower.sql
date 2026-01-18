-- Migration: Equipment and Manpower Master Tables
-- This creates tables for equipment types and manpower categories with hourly rates

-- =====================================================
-- MASTER EQUIPMENT TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS master_equipment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- MASTER MANPOWER TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS master_manpower (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  description TEXT,
  hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_master_equipment_name ON master_equipment(name);
CREATE INDEX IF NOT EXISTS idx_master_equipment_is_active ON master_equipment(is_active);
CREATE INDEX IF NOT EXISTS idx_master_manpower_category ON master_manpower(category);
CREATE INDEX IF NOT EXISTS idx_master_manpower_is_active ON master_manpower(is_active);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE master_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_manpower ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on master_equipment" ON master_equipment;
CREATE POLICY "Allow all operations on master_equipment" ON master_equipment FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on master_manpower" ON master_manpower;
CREATE POLICY "Allow all operations on master_manpower" ON master_manpower FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

DROP TRIGGER IF EXISTS update_master_equipment_updated_at ON master_equipment;
CREATE TRIGGER update_master_equipment_updated_at
  BEFORE UPDATE ON master_equipment
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_master_manpower_updated_at ON master_manpower;
CREATE TRIGGER update_master_manpower_updated_at
  BEFORE UPDATE ON master_manpower
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SEED DATA
-- =====================================================

-- Common equipment types
INSERT INTO master_equipment (name, description, hourly_rate) VALUES
  ('JCB', 'Backhoe Loader', 800.00),
  ('Pokland', 'Poclain Excavator', 1200.00),
  ('Roller', 'Road Roller / Compactor', 600.00),
  ('Mixer', 'Concrete Mixer', 400.00),
  ('Tipper', 'Tipper Truck', 700.00),
  ('Transit Mixer', 'Ready Mix Concrete Truck', 1500.00),
  ('Crane', 'Mobile Crane', 2000.00),
  ('Dumper', 'Dumper Truck', 500.00),
  ('Vibrator', 'Concrete Vibrator', 150.00),
  ('Generator', 'Power Generator', 300.00)
ON CONFLICT DO NOTHING;

-- Common manpower categories
INSERT INTO master_manpower (category, description, hourly_rate) VALUES
  ('Worker', 'General Construction Worker', 50.00),
  ('Mason', 'Skilled Mason', 75.00),
  ('Carpenter', 'Skilled Carpenter', 75.00),
  ('Plumber', 'Skilled Plumber', 80.00),
  ('Electrician', 'Skilled Electrician', 85.00),
  ('Welder', 'Skilled Welder', 90.00),
  ('Supervisor', 'Site Supervisor', 125.00),
  ('Foreman', 'Work Foreman', 100.00),
  ('Helper', 'Unskilled Helper', 40.00),
  ('Operator', 'Equipment Operator', 100.00)
ON CONFLICT DO NOTHING;
