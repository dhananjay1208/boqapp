-- Migration: Checklist sections + per-template signatories
--
-- - section: nullable text on each item, lets one template group items into
--   subsections (e.g., "Before start of work", "During Execution",
--   "Post Completion" for the Core cuttings checklist). Templates that
--   don't need sections leave it NULL and the PDF/UI render flat as before.
-- - signatories: ordered list of role names that appear in the signature
--   block at the bottom of the printed checklist. Default reflects the
--   standard six representatives used across the existing Excel templates.

ALTER TABLE checklist_template_items
  ADD COLUMN IF NOT EXISTS section TEXT;

ALTER TABLE checklist_templates
  ADD COLUMN IF NOT EXISTS signatories TEXT[] NOT NULL DEFAULT ARRAY[
    'C&W Representative',
    'Electrical Representative',
    'HVAC Representative',
    'Siemens Representative',
    'IT Representative',
    'Ostraca Representative'
  ];
