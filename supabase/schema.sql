-- BOQ Management System Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Sites (Projects/Clients)
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  client_name TEXT,
  location TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Packages (Work Categories under a Site)
CREATE TABLE IF NOT EXISTS packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BOQ Headline Items (Main work categories like PCC Work, Brick Work)
CREATE TABLE IF NOT EXISTS boq_headlines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  serial_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BOQ Line Items (Sub-items under each headline)
-- Columns match the BOQ template: S.No (item_number), Description, Location, Unit, Quantity
CREATE TABLE IF NOT EXISTS boq_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  headline_id UUID NOT NULL REFERENCES boq_headlines(id) ON DELETE CASCADE,
  item_number TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT,
  unit TEXT NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- MATERIAL TRACKING TABLES
-- =====================================================

-- Materials (Required for BOQ Line Items)
CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_item_id UUID NOT NULL REFERENCES boq_line_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  material_type TEXT CHECK (material_type IN ('direct', 'indirect')),
  unit TEXT NOT NULL,
  required_quantity DECIMAL(12,3),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Material Receipts (Date-wise tracking of material received)
CREATE TABLE IF NOT EXISTS material_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  invoice_number TEXT,
  receipt_date DATE NOT NULL,
  quantity_received DECIMAL(12,3) NOT NULL,
  vendor_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compliance Documents (Documents per Material)
-- Document types:
--   dc: Delivery Challan/Eway Bill/Invoice
--   mir: Material Inspection Report
--   test_certificate: Test Certificate
--   tds: Technical Data Sheet
CREATE TABLE IF NOT EXISTS compliance_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('dc', 'mir', 'test_certificate', 'tds')),
  file_path TEXT,
  file_name TEXT,
  is_applicable BOOLEAN DEFAULT TRUE,
  is_uploaded BOOLEAN DEFAULT FALSE,
  uploaded_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CHECKLIST TABLES
-- =====================================================

-- Checklists (Activity tracking per BOQ Headline)
CREATE TABLE IF NOT EXISTS checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  headline_id UUID NOT NULL REFERENCES boq_headlines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Checklist Items (Individual activities)
CREATE TABLE IF NOT EXISTS checklist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checklist_id UUID NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  activity_name TEXT NOT NULL,
  sort_order INTEGER,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- JMR (Joint Measurement Report) TABLES
-- =====================================================

-- JMR Reports
CREATE TABLE IF NOT EXISTS jmr_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  headline_id UUID NOT NULL REFERENCES boq_headlines(id) ON DELETE CASCADE,
  report_number TEXT,
  measurement_date DATE,
  customer_representative TEXT,
  contractor_representative TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'disputed')),
  discrepancies TEXT,
  file_path TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- JMR Line Items (Measurements per BOQ Line Item)
CREATE TABLE IF NOT EXISTS jmr_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  jmr_id UUID NOT NULL REFERENCES jmr_reports(id) ON DELETE CASCADE,
  line_item_id UUID NOT NULL REFERENCES boq_line_items(id),
  boq_quantity DECIMAL(12,3),
  executed_quantity DECIMAL(12,3),
  approved_quantity DECIMAL(12,3),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- BILLING TABLES
-- =====================================================

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  jmr_id UUID REFERENCES jmr_reports(id),
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  total_amount DECIMAL(15,2),
  gst_amount DECIMAL(12,2),
  grand_total DECIMAL(15,2),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partially_paid', 'paid')),
  payment_due_date DATE,
  file_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  payment_mode TEXT,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_packages_site_id ON packages(site_id);
CREATE INDEX IF NOT EXISTS idx_boq_headlines_package_id ON boq_headlines(package_id);
CREATE INDEX IF NOT EXISTS idx_boq_line_items_headline_id ON boq_line_items(headline_id);
CREATE INDEX IF NOT EXISTS idx_materials_line_item_id ON materials(line_item_id);
CREATE INDEX IF NOT EXISTS idx_material_receipts_material_id ON material_receipts(material_id);
CREATE INDEX IF NOT EXISTS idx_compliance_documents_material_id ON compliance_documents(material_id);
CREATE INDEX IF NOT EXISTS idx_checklists_headline_id ON checklists(headline_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist_id ON checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_jmr_reports_headline_id ON jmr_reports(headline_id);
CREATE INDEX IF NOT EXISTS idx_jmr_line_items_jmr_id ON jmr_line_items(jmr_id);
CREATE INDEX IF NOT EXISTS idx_invoices_site_id ON invoices(site_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);

-- =====================================================
-- TRIGGER FOR updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists before creating
DROP TRIGGER IF EXISTS update_sites_updated_at ON sites;

CREATE TRIGGER update_sites_updated_at
    BEFORE UPDATE ON sites
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (Permissive for now - no auth)
-- =====================================================

-- Disable RLS for now since we don't have authentication
-- These can be enabled later when auth is added

ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE boq_headlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE boq_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE jmr_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE jmr_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then create new ones
DROP POLICY IF EXISTS "Allow all operations on sites" ON sites;
DROP POLICY IF EXISTS "Allow all operations on packages" ON packages;
DROP POLICY IF EXISTS "Allow all operations on boq_headlines" ON boq_headlines;
DROP POLICY IF EXISTS "Allow all operations on boq_line_items" ON boq_line_items;
DROP POLICY IF EXISTS "Allow all operations on materials" ON materials;
DROP POLICY IF EXISTS "Allow all operations on material_receipts" ON material_receipts;
DROP POLICY IF EXISTS "Allow all operations on compliance_documents" ON compliance_documents;
DROP POLICY IF EXISTS "Allow all operations on checklists" ON checklists;
DROP POLICY IF EXISTS "Allow all operations on checklist_items" ON checklist_items;
DROP POLICY IF EXISTS "Allow all operations on jmr_reports" ON jmr_reports;
DROP POLICY IF EXISTS "Allow all operations on jmr_line_items" ON jmr_line_items;
DROP POLICY IF EXISTS "Allow all operations on invoices" ON invoices;
DROP POLICY IF EXISTS "Allow all operations on payments" ON payments;

-- Create permissive policies (allow all operations for anon users)
CREATE POLICY "Allow all operations on sites" ON sites FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on packages" ON packages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on boq_headlines" ON boq_headlines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on boq_line_items" ON boq_line_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on materials" ON materials FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on material_receipts" ON material_receipts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on compliance_documents" ON compliance_documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on checklists" ON checklists FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on checklist_items" ON checklist_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on jmr_reports" ON jmr_reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on jmr_line_items" ON jmr_line_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on invoices" ON invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on payments" ON payments FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- STORAGE BUCKET FOR DOCUMENTS
-- =====================================================

-- Run this separately in Supabase Dashboard > Storage
-- Or use the Supabase client to create the bucket

-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('documents', 'documents', false);
