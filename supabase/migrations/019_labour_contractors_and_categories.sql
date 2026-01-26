-- Migration: Create Labour Contractors and Manpower Categories tables
-- Normalizes manpower master data structure

-- =====================================================
-- LABOUR CONTRACTORS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS master_labour_contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  contact_number TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- MANPOWER CATEGORIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS master_manpower_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_master_labour_contractors_name ON master_labour_contractors(name);
CREATE INDEX IF NOT EXISTS idx_master_manpower_categories_name ON master_manpower_categories(name);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE master_labour_contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_manpower_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on master_labour_contractors" ON master_labour_contractors;
CREATE POLICY "Allow all operations on master_labour_contractors" ON master_labour_contractors FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on master_manpower_categories" ON master_manpower_categories;
CREATE POLICY "Allow all operations on master_manpower_categories" ON master_manpower_categories FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================
DROP TRIGGER IF EXISTS update_master_labour_contractors_updated_at ON master_labour_contractors;
CREATE TRIGGER update_master_labour_contractors_updated_at
  BEFORE UPDATE ON master_labour_contractors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_master_manpower_categories_updated_at ON master_manpower_categories;
CREATE TRIGGER update_master_manpower_categories_updated_at
  BEFORE UPDATE ON master_manpower_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- UPDATE MASTER_MANPOWER TABLE
-- =====================================================
-- Add foreign key columns to master_manpower
ALTER TABLE master_manpower
ADD COLUMN IF NOT EXISTS contractor_id UUID REFERENCES master_labour_contractors(id);

ALTER TABLE master_manpower
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES master_manpower_categories(id);

-- Create indexes for the new foreign keys
CREATE INDEX IF NOT EXISTS idx_master_manpower_contractor_id ON master_manpower(contractor_id);
CREATE INDEX IF NOT EXISTS idx_master_manpower_category_id ON master_manpower(category_id);
