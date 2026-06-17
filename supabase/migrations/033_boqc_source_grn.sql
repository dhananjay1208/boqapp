-- 033_boqc_source_grn.sql
-- Allow 'grn' as a provenance value on boqc_materials.source, so materials
-- auto-added from a Material GRN (when the GRN line item is linked to a BOQ
-- line item) can be distinguished from AI / manual entries in the compliance UI.

ALTER TABLE boqc_materials DROP CONSTRAINT IF EXISTS boqc_materials_source_check;
ALTER TABLE boqc_materials ADD CONSTRAINT boqc_materials_source_check
  CHECK (source IN ('ai', 'manual', 'ai_edited', 'grn'));
