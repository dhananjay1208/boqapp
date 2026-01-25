-- Migration: GRN Restructure - Invoice-based entry with multiple materials
-- This creates new tables to support invoice-level GRN with multiple line items per invoice

-- =====================================================
-- GRN INVOICES TABLE (Header)
-- =====================================================

CREATE TABLE IF NOT EXISTS grn_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  invoice_number TEXT NOT NULL,
  grn_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for grn_invoices
CREATE INDEX IF NOT EXISTS idx_grn_invoices_site_id ON grn_invoices(site_id);
CREATE INDEX IF NOT EXISTS idx_grn_invoices_supplier_id ON grn_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_grn_invoices_invoice_number ON grn_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_grn_invoices_grn_date ON grn_invoices(grn_date);

-- =====================================================
-- GRN INVOICE DC TABLE (Invoice-Level Document)
-- =====================================================

CREATE TABLE IF NOT EXISTS grn_invoice_dc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_invoice_id UUID NOT NULL REFERENCES grn_invoices(id) ON DELETE CASCADE,
  is_applicable BOOLEAN DEFAULT TRUE,
  is_uploaded BOOLEAN DEFAULT FALSE,
  file_path TEXT,
  file_name TEXT,
  document_date DATE,
  uploaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for grn_invoice_dc
CREATE INDEX IF NOT EXISTS idx_grn_invoice_dc_invoice_id ON grn_invoice_dc(grn_invoice_id);

-- =====================================================
-- GRN LINE ITEMS TABLE (Materials)
-- =====================================================

CREATE TABLE IF NOT EXISTS grn_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_invoice_id UUID NOT NULL REFERENCES grn_invoices(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES master_materials(id),
  material_name TEXT NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unit TEXT NOT NULL,
  rate DECIMAL(15,2) NOT NULL,
  gst_rate DECIMAL(5,2) NOT NULL CHECK (gst_rate IN (5.00, 12.00, 18.00)),
  amount_without_gst DECIMAL(15,2) GENERATED ALWAYS AS (quantity * rate) STORED,
  amount_with_gst DECIMAL(15,2) GENERATED ALWAYS AS (quantity * rate * (1 + gst_rate / 100)) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for grn_line_items
CREATE INDEX IF NOT EXISTS idx_grn_line_items_invoice_id ON grn_line_items(grn_invoice_id);
CREATE INDEX IF NOT EXISTS idx_grn_line_items_material_id ON grn_line_items(material_id);

-- =====================================================
-- GRN LINE ITEM DOCUMENTS TABLE (MIR, Test Cert, TDS only - NO DC)
-- =====================================================

CREATE TABLE IF NOT EXISTS grn_line_item_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_line_item_id UUID NOT NULL REFERENCES grn_line_items(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('mir', 'test_certificate', 'tds')),
  is_applicable BOOLEAN DEFAULT TRUE,
  is_uploaded BOOLEAN DEFAULT FALSE,
  file_path TEXT,
  file_name TEXT,
  document_date DATE,
  uploaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for grn_line_item_documents
CREATE INDEX IF NOT EXISTS idx_grn_line_item_documents_line_item_id ON grn_line_item_documents(grn_line_item_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE grn_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE grn_invoice_dc ENABLE ROW LEVEL SECURITY;
ALTER TABLE grn_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE grn_line_item_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on grn_invoices" ON grn_invoices;
CREATE POLICY "Allow all operations on grn_invoices" ON grn_invoices FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on grn_invoice_dc" ON grn_invoice_dc;
CREATE POLICY "Allow all operations on grn_invoice_dc" ON grn_invoice_dc FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on grn_line_items" ON grn_line_items;
CREATE POLICY "Allow all operations on grn_line_items" ON grn_line_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on grn_line_item_documents" ON grn_line_item_documents;
CREATE POLICY "Allow all operations on grn_line_item_documents" ON grn_line_item_documents FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger for updated_at on grn_invoices
DROP TRIGGER IF EXISTS update_grn_invoices_updated_at ON grn_invoices;
CREATE TRIGGER update_grn_invoices_updated_at
  BEFORE UPDATE ON grn_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
