-- Migration: BOQ JMR (Joint Measurement Reports) per Line Item
-- This adds support for uploading JMR reports against BOQ line items

-- =====================================================
-- BOQ JMR TABLE
-- =====================================================

-- JMR Reports linked directly to BOQ Line Items
CREATE TABLE IF NOT EXISTS boq_jmr (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_item_id UUID NOT NULL REFERENCES boq_line_items(id) ON DELETE CASCADE,
  jmr_number TEXT,
  jmr_date DATE,
  measurement_date DATE,
  boq_quantity DECIMAL(12,3),
  executed_quantity DECIMAL(12,3),
  approved_quantity DECIMAL(12,3),
  customer_representative TEXT,
  contractor_representative TEXT,
  remarks TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'disputed')),
  file_path TEXT,
  file_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_boq_jmr_line_item_id ON boq_jmr(line_item_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE boq_jmr ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on boq_jmr" ON boq_jmr;
CREATE POLICY "Allow all operations on boq_jmr" ON boq_jmr FOR ALL USING (true) WITH CHECK (true);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_boq_jmr_updated_at ON boq_jmr;
CREATE TRIGGER update_boq_jmr_updated_at
  BEFORE UPDATE ON boq_jmr
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
