-- Migration: Allow multiple compliance documents per type per material
-- This adds document_date field and removes unique constraint to allow multiple DCs, MIRs, etc.

-- Add document_date column if it doesn't exist
ALTER TABLE compliance_documents
ADD COLUMN IF NOT EXISTS document_date DATE;

-- Add a description/reference field for identifying documents
ALTER TABLE compliance_documents
ADD COLUMN IF NOT EXISTS reference_number TEXT;

-- Note: The current design allows multiple documents of the same type per material
-- since there's no unique constraint on (material_id, document_type)
-- If there was one, we would drop it here:
-- ALTER TABLE compliance_documents DROP CONSTRAINT IF EXISTS compliance_documents_material_id_document_type_key;
