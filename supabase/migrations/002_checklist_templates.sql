-- Migration: Checklist Templates and BOQ Checklists
-- This adds support for checklist templates that can be filled out against BOQ line items

-- =====================================================
-- CHECKLIST TEMPLATES
-- =====================================================

-- Checklist Templates (reusable templates)
CREATE TABLE IF NOT EXISTS checklist_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  notes_template TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Template Items (items in a template)
CREATE TABLE IF NOT EXISTS checklist_template_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  item_no INTEGER NOT NULL,
  description TEXT NOT NULL,
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- BOQ CHECKLISTS (Filled checklists against BOQ items)
-- =====================================================

-- Filled Checklists for BOQ Line Items
CREATE TABLE IF NOT EXISTS boq_checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_item_id UUID NOT NULL REFERENCES boq_line_items(id) ON DELETE CASCADE,
  template_id UUID REFERENCES checklist_templates(id) ON DELETE SET NULL,
  checklist_name TEXT NOT NULL,
  project TEXT,
  shop_drawing_no TEXT,
  make TEXT,
  checklist_date DATE,
  location TEXT,
  notes TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Checklist Item Responses
CREATE TABLE IF NOT EXISTS boq_checklist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checklist_id UUID NOT NULL REFERENCES boq_checklists(id) ON DELETE CASCADE,
  item_no INTEGER NOT NULL,
  description TEXT NOT NULL,
  status TEXT CHECK (status IN ('Y', 'N', 'NA', null)),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Checklist Clearances (signatures)
CREATE TABLE IF NOT EXISTS boq_checklist_clearances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checklist_id UUID NOT NULL REFERENCES boq_checklists(id) ON DELETE CASCADE,
  clearance_type TEXT NOT NULL CHECK (clearance_type IN ('cw', 'electrical', 'hvac')),
  representative_name TEXT,
  clearance_date DATE,
  signature TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_checklist_template_items_template_id ON checklist_template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_boq_checklists_line_item_id ON boq_checklists(line_item_id);
CREATE INDEX IF NOT EXISTS idx_boq_checklists_template_id ON boq_checklists(template_id);
CREATE INDEX IF NOT EXISTS idx_boq_checklist_items_checklist_id ON boq_checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_boq_checklist_clearances_checklist_id ON boq_checklist_clearances(checklist_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE boq_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE boq_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE boq_checklist_clearances ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Allow all operations on checklist_templates" ON checklist_templates;
DROP POLICY IF EXISTS "Allow all operations on checklist_template_items" ON checklist_template_items;
DROP POLICY IF EXISTS "Allow all operations on boq_checklists" ON boq_checklists;
DROP POLICY IF EXISTS "Allow all operations on boq_checklist_items" ON boq_checklist_items;
DROP POLICY IF EXISTS "Allow all operations on boq_checklist_clearances" ON boq_checklist_clearances;

CREATE POLICY "Allow all operations on checklist_templates" ON checklist_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on checklist_template_items" ON checklist_template_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on boq_checklists" ON boq_checklists FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on boq_checklist_items" ON boq_checklist_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on boq_checklist_clearances" ON boq_checklist_clearances FOR ALL USING (true) WITH CHECK (true);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_boq_checklists_updated_at ON boq_checklists;
CREATE TRIGGER update_boq_checklists_updated_at
  BEFORE UPDATE ON boq_checklists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
