-- Migration: Add signed copy columns to boq_checklists
-- This allows uploading signed physical copies of completed checklists

ALTER TABLE boq_checklists ADD COLUMN IF NOT EXISTS signed_copy_path TEXT;
ALTER TABLE boq_checklists ADD COLUMN IF NOT EXISTS signed_copy_name TEXT;
