-- 032_grant_boq_item_modules.sql
-- Convenience: grant the two new module keys to any existing user who already
-- has access to the 'boq' module, so pilot users see the new modules without a
-- manual edit in /admin/users. Superusers (e.g. Cogneta) auto-see all modules,
-- so they need no change.
--
-- Idempotent: array_agg(DISTINCT ...) de-dupes, so re-running adds nothing new.

UPDATE tenant_users
SET allowed_modules = (
  SELECT array_agg(DISTINCT m)
  FROM unnest(allowed_modules || ARRAY['boq-item-compliance', 'boq-item-overview']) AS m
)
WHERE 'boq' = ANY(allowed_modules);
