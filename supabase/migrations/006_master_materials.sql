-- Migration: Master Materials Table
-- This creates a master list of materials that can be used across the application

-- =====================================================
-- MASTER MATERIALS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS master_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_master_materials_category ON master_materials(category);
CREATE INDEX IF NOT EXISTS idx_master_materials_name ON master_materials(name);
CREATE INDEX IF NOT EXISTS idx_master_materials_is_active ON master_materials(is_active);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE master_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on master_materials" ON master_materials;
CREATE POLICY "Allow all operations on master_materials" ON master_materials FOR ALL USING (true) WITH CHECK (true);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_master_materials_updated_at ON master_materials;
CREATE TRIGGER update_master_materials_updated_at
  BEFORE UPDATE ON master_materials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
