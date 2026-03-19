-- Supply & Installation (S&I) package support
-- Adds billing_type to packages and S&I-specific columns to boq_line_items

-- Package billing type
ALTER TABLE packages ADD COLUMN IF NOT EXISTS billing_type TEXT DEFAULT 'standard'
  CHECK (billing_type IN ('standard', 'supply_installation'));

-- S&I columns on boq_line_items (all nullable, no impact on existing data)
ALTER TABLE boq_line_items ADD COLUMN IF NOT EXISTS qty_ext TEXT;
ALTER TABLE boq_line_items ADD COLUMN IF NOT EXISTS supply_rate DECIMAL(12,2);
ALTER TABLE boq_line_items ADD COLUMN IF NOT EXISTS installation_rate DECIMAL(12,2);
ALTER TABLE boq_line_items ADD COLUMN IF NOT EXISTS supply_amount DECIMAL(14,2);
ALTER TABLE boq_line_items ADD COLUMN IF NOT EXISTS installation_amount DECIMAL(14,2);
ALTER TABLE boq_line_items ADD COLUMN IF NOT EXISTS actual_supply_amount DECIMAL(14,2);
ALTER TABLE boq_line_items ADD COLUMN IF NOT EXISTS actual_installation_amount DECIMAL(14,2);
ALTER TABLE boq_line_items ADD COLUMN IF NOT EXISTS actual_total_amount DECIMAL(14,2);
