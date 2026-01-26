-- Migration: Workstation Management System
-- Track work progress and material consumption at physical workstations

-- =====================================================
-- TABLE 1: MASTER WORKSTATIONS (Master Data)
-- =====================================================
CREATE TABLE IF NOT EXISTS master_workstations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE 2: SITE WORKSTATIONS (Workstations assigned to sites)
-- =====================================================
CREATE TABLE IF NOT EXISTS site_workstations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  workstation_id UUID NOT NULL REFERENCES master_workstations(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, workstation_id)
);

-- =====================================================
-- TABLE 3: WORKSTATION BOQ PROGRESS (Progress tracking)
-- =====================================================
CREATE TABLE IF NOT EXISTS workstation_boq_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_workstation_id UUID NOT NULL REFERENCES site_workstations(id) ON DELETE CASCADE,
  boq_line_item_id UUID NOT NULL REFERENCES boq_line_items(id),
  entry_date DATE NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLE 4: WORKSTATION MATERIAL CONSUMPTION (Material usage)
-- =====================================================
CREATE TABLE IF NOT EXISTS workstation_material_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workstation_boq_progress_id UUID NOT NULL REFERENCES workstation_boq_progress(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES master_materials(id),
  material_name TEXT NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unit TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_master_workstations_name ON master_workstations(name);
CREATE INDEX IF NOT EXISTS idx_master_workstations_is_active ON master_workstations(is_active);

CREATE INDEX IF NOT EXISTS idx_site_workstations_site_id ON site_workstations(site_id);
CREATE INDEX IF NOT EXISTS idx_site_workstations_workstation_id ON site_workstations(workstation_id);

CREATE INDEX IF NOT EXISTS idx_workstation_boq_progress_site_workstation_id ON workstation_boq_progress(site_workstation_id);
CREATE INDEX IF NOT EXISTS idx_workstation_boq_progress_boq_line_item_id ON workstation_boq_progress(boq_line_item_id);
CREATE INDEX IF NOT EXISTS idx_workstation_boq_progress_entry_date ON workstation_boq_progress(entry_date);

CREATE INDEX IF NOT EXISTS idx_workstation_material_consumption_progress_id ON workstation_material_consumption(workstation_boq_progress_id);
CREATE INDEX IF NOT EXISTS idx_workstation_material_consumption_material_id ON workstation_material_consumption(material_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE master_workstations ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_workstations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workstation_boq_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE workstation_material_consumption ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on master_workstations" ON master_workstations;
CREATE POLICY "Allow all operations on master_workstations" ON master_workstations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on site_workstations" ON site_workstations;
CREATE POLICY "Allow all operations on site_workstations" ON site_workstations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on workstation_boq_progress" ON workstation_boq_progress;
CREATE POLICY "Allow all operations on workstation_boq_progress" ON workstation_boq_progress FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on workstation_material_consumption" ON workstation_material_consumption;
CREATE POLICY "Allow all operations on workstation_material_consumption" ON workstation_material_consumption FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================
DROP TRIGGER IF EXISTS update_master_workstations_updated_at ON master_workstations;
CREATE TRIGGER update_master_workstations_updated_at
  BEFORE UPDATE ON master_workstations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workstation_boq_progress_updated_at ON workstation_boq_progress;
CREATE TRIGGER update_workstation_boq_progress_updated_at
  BEFORE UPDATE ON workstation_boq_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SEED DATA: 29 PREDEFINED WORKSTATIONS
-- =====================================================
INSERT INTO master_workstations (name, description) VALUES
  ('HT ROOM', 'High Tension Room'),
  ('ELE ROOM', 'Electrical Room'),
  ('FENCING', 'Fencing Area'),
  ('CIVIL WORK', 'Civil Work Area'),
  ('TOILET BLOCK', 'Toilet Block'),
  ('STP', 'Sewage Treatment Plant'),
  ('WATER TANK', 'Water Tank'),
  ('PUMP HOUSE', 'Pump House'),
  ('FIRE FIGHTING', 'Fire Fighting System'),
  ('GENERATOR ROOM', 'Generator Room'),
  ('SECURITY CABIN', 'Security Cabin'),
  ('GATE', 'Main Gate'),
  ('LANDSCAPING', 'Landscaping Area'),
  ('PARKING', 'Parking Area'),
  ('ROAD', 'Internal Roads'),
  ('DRAINAGE', 'Drainage System'),
  ('EARTHWORK', 'Earthwork'),
  ('PCC', 'Plain Cement Concrete'),
  ('RCC', 'Reinforced Cement Concrete'),
  ('MASONRY', 'Masonry Work'),
  ('PLASTERING', 'Plastering Work'),
  ('FLOORING', 'Flooring Work'),
  ('PAINTING', 'Painting Work'),
  ('PLUMBING', 'Plumbing Work'),
  ('ELECTRICAL', 'Electrical Work'),
  ('HVAC', 'HVAC System'),
  ('FALSE CEILING', 'False Ceiling'),
  ('GLAZING', 'Glazing Work'),
  ('MISC', 'Miscellaneous')
ON CONFLICT (name) DO NOTHING;
