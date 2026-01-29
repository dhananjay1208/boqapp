-- Migration: Add invoice_date to grn_invoices
-- Captures the actual invoice date separately from GRN date

-- Add invoice_date column
ALTER TABLE grn_invoices
ADD COLUMN IF NOT EXISTS invoice_date DATE;

-- For existing records, set invoice_date = grn_date
UPDATE grn_invoices
SET invoice_date = grn_date
WHERE invoice_date IS NULL;

-- Make it NOT NULL after populating
ALTER TABLE grn_invoices
ALTER COLUMN invoice_date SET NOT NULL;

-- Add index for invoice_date
CREATE INDEX IF NOT EXISTS idx_grn_invoices_invoice_date ON grn_invoices(invoice_date);
