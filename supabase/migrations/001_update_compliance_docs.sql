-- Migration: Update compliance documents table
-- Run this if you already have the database set up

-- Drop the old constraint and add new one
ALTER TABLE compliance_documents
DROP CONSTRAINT IF EXISTS compliance_documents_document_type_check;

ALTER TABLE compliance_documents
ADD CONSTRAINT compliance_documents_document_type_check
CHECK (document_type IN ('dc', 'mir', 'test_certificate', 'tds'));

-- Update any existing records with old document types
UPDATE compliance_documents SET document_type = 'dc'
WHERE document_type IN ('delivery_challan', 'eway_bill', 'invoice');

-- Create storage bucket for compliance documents
-- Run this in Supabase Dashboard > Storage or via SQL:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('compliance-docs', 'compliance-docs', false);

-- Storage policy to allow authenticated uploads (for now, allow all)
-- Run in Supabase Dashboard > Storage > Policies or via SQL:
/*
CREATE POLICY "Allow public uploads to compliance-docs" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'compliance-docs');

CREATE POLICY "Allow public reads from compliance-docs" ON storage.objects
FOR SELECT USING (bucket_id = 'compliance-docs');

CREATE POLICY "Allow public deletes from compliance-docs" ON storage.objects
FOR DELETE USING (bucket_id = 'compliance-docs');
*/
