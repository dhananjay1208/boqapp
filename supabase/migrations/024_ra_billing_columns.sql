-- Add RA Billing columns to boq_line_items
-- All nullable so existing data is unaffected

ALTER TABLE boq_line_items ADD COLUMN IF NOT EXISTS rate DECIMAL(12,2);
ALTER TABLE boq_line_items ADD COLUMN IF NOT EXISTS total_amount DECIMAL(14,2);
ALTER TABLE boq_line_items ADD COLUMN IF NOT EXISTS gst_amount DECIMAL(14,2);
ALTER TABLE boq_line_items ADD COLUMN IF NOT EXISTS total_amount_with_gst DECIMAL(14,2);
ALTER TABLE boq_line_items ADD COLUMN IF NOT EXISTS actual_quantity DECIMAL(12,3);
ALTER TABLE boq_line_items ADD COLUMN IF NOT EXISTS actual_amount DECIMAL(14,2);
ALTER TABLE boq_line_items ADD COLUMN IF NOT EXISTS actual_amount_with_gst DECIMAL(14,2);
