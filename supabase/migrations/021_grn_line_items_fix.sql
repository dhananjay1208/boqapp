-- Migration: Fix GRN Line Items - Remove computed columns, add actual amount columns
-- This allows storing the actual amounts from invoices (which may include discounts)

-- Step 1: Add new columns for actual amounts
ALTER TABLE grn_line_items
ADD COLUMN IF NOT EXISTS amount_without_gst_actual DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS amount_with_gst_actual DECIMAL(15,2);

-- Step 2: Copy computed values to actual columns (for existing data)
UPDATE grn_line_items
SET amount_without_gst_actual = amount_without_gst,
    amount_with_gst_actual = amount_with_gst
WHERE amount_without_gst_actual IS NULL;

-- Step 3: Drop the computed columns
ALTER TABLE grn_line_items DROP COLUMN IF EXISTS amount_without_gst;
ALTER TABLE grn_line_items DROP COLUMN IF EXISTS amount_with_gst;

-- Step 4: Rename actual columns to standard names
ALTER TABLE grn_line_items RENAME COLUMN amount_without_gst_actual TO amount_without_gst;
ALTER TABLE grn_line_items RENAME COLUMN amount_with_gst_actual TO amount_with_gst;
