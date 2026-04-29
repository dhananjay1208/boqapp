-- Migration: Per-package toggle for the source of "Actual Qty" shown in RA Billing
--
-- 'execution' (default) = derive Actual Qty from BOQ Management's Upto Date
--                         (sum of approved JMR quantities, falling back to
--                         workstation_boq_progress sum). Actual Amt is then
--                         computed as uptoDate * rate (and applies the line
--                         item's GST percentage to produce Actual w/ GST).
-- 'template'             = use the actual_quantity / actual_amount /
--                         actual_amount_with_gst columns as imported from the
--                         BOQ Excel template (the legacy behavior).
--
-- NOT NULL DEFAULT backfills all existing rows with 'execution' on add.

ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS actual_source TEXT NOT NULL DEFAULT 'execution'
  CHECK (actual_source IN ('template', 'execution'));
