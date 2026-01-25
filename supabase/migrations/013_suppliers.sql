-- Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name TEXT NOT NULL,
  address TEXT,
  state TEXT,
  gstin TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on supplier name for faster lookups
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(supplier_name);

-- Create index on GSTIN for faster lookups
CREATE INDEX IF NOT EXISTS idx_suppliers_gstin ON suppliers(gstin);
