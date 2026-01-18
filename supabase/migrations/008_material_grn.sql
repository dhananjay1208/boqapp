-- Migration: Material GRN (Goods Receipt Note) and Compliance
-- This creates tables for recording material deliveries and their compliance documents

-- =====================================================
-- MATERIAL GRN TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS material_grn (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  grn_date DATE NOT NULL,
  vendor_name TEXT NOT NULL,
  invoice_number TEXT,
  invoice_amount DECIMAL(15,2),
  material_id UUID NOT NULL REFERENCES master_materials(id),
  material_name TEXT NOT NULL,  -- Denormalized for quick display
  quantity DECIMAL(12,3) NOT NULL,
  unit TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- GRN COMPLIANCE DOCUMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS grn_compliance_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grn_id UUID NOT NULL REFERENCES material_grn(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('dc', 'mir', 'test_certificate', 'tds')),
  is_applicable BOOLEAN DEFAULT TRUE,
  is_uploaded BOOLEAN DEFAULT FALSE,
  file_path TEXT,
  file_name TEXT,
  document_date DATE,
  uploaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_material_grn_site_id ON material_grn(site_id);
CREATE INDEX IF NOT EXISTS idx_material_grn_grn_date ON material_grn(grn_date);
CREATE INDEX IF NOT EXISTS idx_material_grn_material_id ON material_grn(material_id);
CREATE INDEX IF NOT EXISTS idx_material_grn_vendor_name ON material_grn(vendor_name);
CREATE INDEX IF NOT EXISTS idx_grn_compliance_documents_grn_id ON grn_compliance_documents(grn_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE material_grn ENABLE ROW LEVEL SECURITY;
ALTER TABLE grn_compliance_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on material_grn" ON material_grn;
CREATE POLICY "Allow all operations on material_grn" ON material_grn FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on grn_compliance_documents" ON grn_compliance_documents;
CREATE POLICY "Allow all operations on grn_compliance_documents" ON grn_compliance_documents FOR ALL USING (true) WITH CHECK (true);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_material_grn_updated_at ON material_grn;
CREATE TRIGGER update_material_grn_updated_at
  BEFORE UPDATE ON material_grn
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
