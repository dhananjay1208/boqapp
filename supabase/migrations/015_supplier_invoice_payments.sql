-- Migration: Supplier Invoice Payments
-- Tracks payment status for supplier invoices

CREATE TABLE IF NOT EXISTS supplier_invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  invoice_number TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
  payment_reference TEXT,
  paid_at TIMESTAMPTZ,
  paid_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, supplier_id, invoice_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_payments_site ON supplier_invoice_payments(site_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_payments_supplier ON supplier_invoice_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_payments_status ON supplier_invoice_payments(payment_status);

-- RLS
ALTER TABLE supplier_invoice_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on supplier_invoice_payments" ON supplier_invoice_payments;
CREATE POLICY "Allow all operations on supplier_invoice_payments" ON supplier_invoice_payments FOR ALL USING (true) WITH CHECK (true);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_supplier_invoice_payments_updated_at ON supplier_invoice_payments;
CREATE TRIGGER update_supplier_invoice_payments_updated_at
  BEFORE UPDATE ON supplier_invoice_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
