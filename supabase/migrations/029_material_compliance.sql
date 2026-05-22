-- 029_material_compliance.sql
-- Material-level Test Certificate / TDS compliance documents.
--
-- The Documents Compliance module uses this table as the master record. The
-- existing grn_line_item_documents table stays untouched and continues to hold
-- per-invoice / per-line-item overrides.
--
-- Files live in the existing compliance-docs bucket at:
--   material-compliance/{material_id}/{doc_type}_{timestamp}.{ext}

CREATE TABLE IF NOT EXISTS material_compliance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES master_materials(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('test_certificate', 'tds')),
  status TEXT NOT NULL DEFAULT 'pending'
         CHECK (status IN ('pending', 'uploaded', 'not_applicable')),
  file_path TEXT,
  file_name TEXT,
  uploaded_at TIMESTAMPTZ,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (material_id, doc_type)
);

CREATE INDEX IF NOT EXISTS idx_material_compliance_material_id
  ON material_compliance_documents(material_id);

-- Auto-bump updated_at on every UPDATE.
CREATE OR REPLACE FUNCTION touch_material_compliance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_material_compliance_updated_at ON material_compliance_documents;
CREATE TRIGGER trg_material_compliance_updated_at
  BEFORE UPDATE ON material_compliance_documents
  FOR EACH ROW EXECUTE FUNCTION touch_material_compliance_updated_at();

-- Permissive RLS to match the rest of the schema (demo-grade auth).
ALTER TABLE material_compliance_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Open access" ON material_compliance_documents;
CREATE POLICY "Open access" ON material_compliance_documents
  FOR ALL USING (TRUE) WITH CHECK (TRUE);
