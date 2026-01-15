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

-- =====================================================
-- STORAGE BUCKET SETUP (Run in Supabase SQL Editor)
-- =====================================================

-- Step 1: Create the storage bucket (if not already created via Dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('compliance-docs', 'compliance-docs', true);

-- Step 2: Add RLS policies for the storage bucket
-- IMPORTANT: Run these policies in Supabase SQL Editor

-- Allow anyone to upload files
CREATE POLICY "Allow public uploads" ON storage.objects
FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'compliance-docs');

-- Allow anyone to read/download files
CREATE POLICY "Allow public reads" ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'compliance-docs');

-- Allow anyone to update files
CREATE POLICY "Allow public updates" ON storage.objects
FOR UPDATE TO anon, authenticated
USING (bucket_id = 'compliance-docs');

-- Allow anyone to delete files
CREATE POLICY "Allow public deletes" ON storage.objects
FOR DELETE TO anon, authenticated
USING (bucket_id = 'compliance-docs');
