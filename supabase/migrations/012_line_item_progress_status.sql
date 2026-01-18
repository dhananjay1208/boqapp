-- Add Checklist and JMR progress status columns to BOQ Line Items
-- This helps track the progress of each line item through the workflow

-- Checklist Status: not_applicable, pending, created, in_progress, completed, approved, uploaded
-- JMR Status: not_applicable, pending, in_progress, completed, approved, uploaded

ALTER TABLE boq_line_items
ADD COLUMN IF NOT EXISTS checklist_status TEXT DEFAULT 'pending';

ALTER TABLE boq_line_items
ADD COLUMN IF NOT EXISTS jmr_status TEXT DEFAULT 'pending';

-- Add check constraints for valid status values
ALTER TABLE boq_line_items
ADD CONSTRAINT check_checklist_status
CHECK (checklist_status IN ('not_applicable', 'pending', 'created', 'in_progress', 'completed', 'approved', 'uploaded'));

ALTER TABLE boq_line_items
ADD CONSTRAINT check_jmr_status
CHECK (jmr_status IN ('not_applicable', 'pending', 'in_progress', 'completed', 'approved', 'uploaded'));

-- Create indexes for filtering by status
CREATE INDEX IF NOT EXISTS idx_boq_line_items_checklist_status ON boq_line_items(checklist_status);
CREATE INDEX IF NOT EXISTS idx_boq_line_items_jmr_status ON boq_line_items(jmr_status);
