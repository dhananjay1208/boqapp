-- Migration: Add payment amount and partial status support
-- Adds payment_amount column and updates status constraint

-- Add payment_amount column
ALTER TABLE supplier_invoice_payments
ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(15,2);

-- Drop the existing constraint and add new one with 'partial' status
ALTER TABLE supplier_invoice_payments
DROP CONSTRAINT IF EXISTS supplier_invoice_payments_payment_status_check;

ALTER TABLE supplier_invoice_payments
ADD CONSTRAINT supplier_invoice_payments_payment_status_check
CHECK (payment_status IN ('pending', 'partial', 'paid'));
