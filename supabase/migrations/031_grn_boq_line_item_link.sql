-- 031_grn_boq_line_item_link.sql
-- Link a GRN line item to the BOQ line item it satisfies.
--
-- This establishes the material <-> BOQ-line-item link that the new
-- /boq-item-compliance module uses to surface test certificates captured at
-- goods-receipt. Nullable + ON DELETE SET NULL keeps every existing GRN row
-- valid; fully additive and non-breaking.

ALTER TABLE grn_line_items
  ADD COLUMN IF NOT EXISTS boq_line_item_id UUID
  REFERENCES boq_line_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_grn_line_items_boq_line_item
  ON grn_line_items(boq_line_item_id);
