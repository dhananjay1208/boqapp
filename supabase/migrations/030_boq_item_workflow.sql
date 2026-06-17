-- 030_boq_item_workflow.sql
-- Per-BOQ-line-item workflow: approved materials, TDS/Test-Cert compliance docs,
-- and RA-billing (Running Account) entries with MB-sheet attachments.
--
-- Powers the two new modules:
--   /boq-item-compliance  (manage/update)
--   /boq-item-overview    (read-only dashboard)
--
-- These tables LAYER ON TOP of the existing read-only boq_line_items; nothing in
-- the existing BOQ Management / RA Billing / BOQ Progress modules is touched.
--
-- Tenancy is reached via boq_line_items -> boq_headlines -> packages -> sites.tenant_id;
-- these tables need no tenant column (rows are reachable only via a tenant's own line items).
--
-- Files live in the existing compliance-docs bucket under the new prefix:
--   boq-item-compliance/{boqc_material_id}/{doc_type}_{timestamp}.{ext}
--   boq-item-compliance/ra/{boq_line_item_id}/RA{ra_number}_{timestamp}.{ext}

-- ---------------------------------------------------------------------------
-- 1. Approved materials per line item (Stage 1)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS boqc_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boq_line_item_id UUID NOT NULL REFERENCES boq_line_items(id) ON DELETE CASCADE,
  material_id UUID REFERENCES master_materials(id) ON DELETE SET NULL, -- NULL = free-text suggestion
  material_name TEXT NOT NULL,            -- denormalized; survives master edits / free-text
  unit TEXT,
  estimated_quantity DECIMAL(14,3),       -- optional AI/engineer estimate
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('ai', 'manual', 'ai_edited')),
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,  -- Stage-1 gate before vendor share / docs
  shared_with_vendor_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (boq_line_item_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_boqc_materials_line_item ON boqc_materials(boq_line_item_id);
CREATE INDEX IF NOT EXISTS idx_boqc_materials_material  ON boqc_materials(material_id);

-- ---------------------------------------------------------------------------
-- 2. TDS + Test Certificate per approved material (Stages 2 & 3)
--    Mirrors material_compliance_documents so effectiveDocStatus() is reusable.
--    Keyed by the boqc_materials row, so the same master material tracks docs
--    independently across different line items.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS boqc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boqc_material_id UUID NOT NULL REFERENCES boqc_materials(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('tds', 'test_certificate')),
  status TEXT NOT NULL DEFAULT 'pending'
         CHECK (status IN ('pending', 'uploaded', 'not_applicable')),
  file_path TEXT,
  file_name TEXT,
  uploaded_at TIMESTAMPTZ,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (boqc_material_id, doc_type)
);

CREATE INDEX IF NOT EXISTS idx_boqc_documents_material ON boqc_documents(boqc_material_id);

-- ---------------------------------------------------------------------------
-- 3. RA billing + MB sheet per line item (Stage 5)
--    new_quantity is the ONLY user-entered quantity; previous/upto-date are
--    server-recomputed (see recomputeRaCumulatives in boq-item-workflow.ts).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS boqc_ra_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boq_line_item_id UUID NOT NULL REFERENCES boq_line_items(id) ON DELETE CASCADE,
  ra_number INTEGER NOT NULL,                          -- 1, 2, 3...
  new_quantity DECIMAL(14,3) NOT NULL DEFAULT 0,       -- engineer-entered this RA
  previous_quantity DECIMAL(14,3) NOT NULL DEFAULT 0,  -- sum of new_quantity of lower ra_numbers
  upto_date_quantity DECIMAL(14,3) NOT NULL DEFAULT 0, -- previous + new (cumulative)
  mb_sheet_file_path TEXT,
  mb_sheet_file_name TEXT,
  remarks TEXT,
  entry_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (boq_line_item_id, ra_number)
);

CREATE INDEX IF NOT EXISTS idx_boqc_ra_line_item ON boqc_ra_entries(boq_line_item_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers (reuse the shared update_updated_at_column() from schema.sql)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_boqc_materials_updated_at ON boqc_materials;
CREATE TRIGGER trg_boqc_materials_updated_at
  BEFORE UPDATE ON boqc_materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_boqc_documents_updated_at ON boqc_documents;
CREATE TRIGGER trg_boqc_documents_updated_at
  BEFORE UPDATE ON boqc_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_boqc_ra_entries_updated_at ON boqc_ra_entries;
CREATE TRIGGER trg_boqc_ra_entries_updated_at
  BEFORE UPDATE ON boqc_ra_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Permissive RLS to match the rest of the schema (demo-grade pilot auth)
-- ---------------------------------------------------------------------------
ALTER TABLE boqc_materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Open access" ON boqc_materials;
CREATE POLICY "Open access" ON boqc_materials FOR ALL USING (TRUE) WITH CHECK (TRUE);

ALTER TABLE boqc_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Open access" ON boqc_documents;
CREATE POLICY "Open access" ON boqc_documents FOR ALL USING (TRUE) WITH CHECK (TRUE);

ALTER TABLE boqc_ra_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Open access" ON boqc_ra_entries;
CREATE POLICY "Open access" ON boqc_ra_entries FOR ALL USING (TRUE) WITH CHECK (TRUE);
