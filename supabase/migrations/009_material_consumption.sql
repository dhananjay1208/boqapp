-- Migration: Material Consumption
-- This creates tables for recording material consumption against BOQ line items

-- =====================================================
-- MATERIAL CONSUMPTION TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS material_consumption (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_item_id UUID NOT NULL REFERENCES boq_line_items(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id),
  material_id UUID NOT NULL REFERENCES master_materials(id),
  material_name TEXT NOT NULL,  -- Denormalized for quick display
  consumption_date DATE NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unit TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_material_consumption_line_item ON material_consumption(line_item_id);
CREATE INDEX IF NOT EXISTS idx_material_consumption_site ON material_consumption(site_id);
CREATE INDEX IF NOT EXISTS idx_material_consumption_material ON material_consumption(material_id);
CREATE INDEX IF NOT EXISTS idx_material_consumption_date ON material_consumption(consumption_date);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE material_consumption ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on material_consumption" ON material_consumption;
CREATE POLICY "Allow all operations on material_consumption" ON material_consumption FOR ALL USING (true) WITH CHECK (true);
