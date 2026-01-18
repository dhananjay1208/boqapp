-- Migration: Site Expenses Recording
-- Tables for recording daily expenses against sites in four categories:
-- Material, Manpower, Equipment, and Other Expenses

-- =====================================================
-- MATERIAL EXPENSES TABLE
-- =====================================================
-- Records material expenses based on invoice amounts

CREATE TABLE IF NOT EXISTS expense_material (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  invoice_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- MANPOWER EXPENSES TABLE
-- =====================================================
-- Records manpower expenses with hours and auto-calculated amount

CREATE TABLE IF NOT EXISTS expense_manpower (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL,
  manpower_id UUID NOT NULL REFERENCES master_manpower(id),
  manpower_category TEXT NOT NULL,  -- Denormalized for display
  hours DECIMAL(6,2) NOT NULL,
  rate DECIMAL(10,2) NOT NULL,  -- Rate at time of recording
  amount DECIMAL(15,2) NOT NULL,  -- Calculated: hours * rate
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- EQUIPMENT EXPENSES TABLE
-- =====================================================
-- Records equipment expenses with hours and auto-calculated amount

CREATE TABLE IF NOT EXISTS expense_equipment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL,
  equipment_id UUID NOT NULL REFERENCES master_equipment(id),
  equipment_name TEXT NOT NULL,  -- Denormalized for display
  hours DECIMAL(6,2) NOT NULL,
  rate DECIMAL(10,2) NOT NULL,  -- Rate at time of recording
  amount DECIMAL(15,2) NOT NULL,  -- Calculated: hours * rate
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- OTHER EXPENSES TABLE
-- =====================================================
-- Records miscellaneous/operational expenses

CREATE TABLE IF NOT EXISTS expense_other (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_expense_material_site_date ON expense_material(site_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expense_manpower_site_date ON expense_manpower(site_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expense_equipment_site_date ON expense_equipment(site_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expense_other_site_date ON expense_other(site_id, expense_date);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE expense_material ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_manpower ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_other ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on expense_material" ON expense_material;
CREATE POLICY "Allow all operations on expense_material" ON expense_material FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on expense_manpower" ON expense_manpower;
CREATE POLICY "Allow all operations on expense_manpower" ON expense_manpower FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on expense_equipment" ON expense_equipment;
CREATE POLICY "Allow all operations on expense_equipment" ON expense_equipment FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on expense_other" ON expense_other;
CREATE POLICY "Allow all operations on expense_other" ON expense_other FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

DROP TRIGGER IF EXISTS update_expense_material_updated_at ON expense_material;
CREATE TRIGGER update_expense_material_updated_at
  BEFORE UPDATE ON expense_material
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expense_manpower_updated_at ON expense_manpower;
CREATE TRIGGER update_expense_manpower_updated_at
  BEFORE UPDATE ON expense_manpower
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expense_equipment_updated_at ON expense_equipment;
CREATE TRIGGER update_expense_equipment_updated_at
  BEFORE UPDATE ON expense_equipment
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expense_other_updated_at ON expense_other;
CREATE TRIGGER update_expense_other_updated_at
  BEFORE UPDATE ON expense_other
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
