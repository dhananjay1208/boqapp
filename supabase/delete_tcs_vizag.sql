-- Script to delete TCS-Vizag site and all associated transactional data
-- Run this in Supabase SQL Editor

-- First, let's find the site ID
-- SELECT id, name FROM sites WHERE name ILIKE '%TCS%Vizag%' OR name ILIKE '%Vizag%';

-- Store the site ID in a variable (replace with actual ID after running the above query)
DO $$
DECLARE
    site_uuid UUID;
BEGIN
    -- Find the site ID
    SELECT id INTO site_uuid FROM sites WHERE name ILIKE '%TCS-Vizag%' OR name ILIKE '%TCS Vizag%';

    IF site_uuid IS NULL THEN
        RAISE NOTICE 'Site TCS-Vizag not found!';
        RETURN;
    END IF;

    RAISE NOTICE 'Found site ID: %', site_uuid;

    -- Delete expense records (these reference site_id directly)
    DELETE FROM expense_material WHERE site_id = site_uuid;
    RAISE NOTICE 'Deleted expense_material records';

    DELETE FROM expense_manpower WHERE site_id = site_uuid;
    RAISE NOTICE 'Deleted expense_manpower records';

    DELETE FROM expense_equipment WHERE site_id = site_uuid;
    RAISE NOTICE 'Deleted expense_equipment records';

    DELETE FROM expense_other WHERE site_id = site_uuid;
    RAISE NOTICE 'Deleted expense_other records';

    -- Delete material consumption records
    DELETE FROM material_consumption WHERE site_id = site_uuid;
    RAISE NOTICE 'Deleted material_consumption records';

    -- Delete GRN compliance documents (via GRN cascade)
    DELETE FROM grn_compliance_documents
    WHERE grn_id IN (SELECT id FROM material_grn WHERE site_id = site_uuid);
    RAISE NOTICE 'Deleted grn_compliance_documents records';

    -- Delete material GRN records
    DELETE FROM material_grn WHERE site_id = site_uuid;
    RAISE NOTICE 'Deleted material_grn records';

    -- Delete checklist items (via checklist cascade)
    DELETE FROM checklist_items
    WHERE checklist_id IN (
        SELECT c.id FROM checklists c
        JOIN boq_headlines h ON c.headline_id = h.id
        JOIN packages p ON h.package_id = p.id
        WHERE p.site_id = site_uuid
    );
    RAISE NOTICE 'Deleted checklist_items records';

    -- Delete checklists
    DELETE FROM checklists
    WHERE headline_id IN (
        SELECT h.id FROM boq_headlines h
        JOIN packages p ON h.package_id = p.id
        WHERE p.site_id = site_uuid
    );
    RAISE NOTICE 'Deleted checklists records';

    -- Delete BOQ JMR entries if exists
    DELETE FROM boq_jmr
    WHERE line_item_id IN (
        SELECT li.id FROM boq_line_items li
        JOIN boq_headlines h ON li.headline_id = h.id
        JOIN packages p ON h.package_id = p.id
        WHERE p.site_id = site_uuid
    );
    RAISE NOTICE 'Deleted boq_jmr records';

    -- Delete BOQ line items
    DELETE FROM boq_line_items
    WHERE headline_id IN (
        SELECT h.id FROM boq_headlines h
        JOIN packages p ON h.package_id = p.id
        WHERE p.site_id = site_uuid
    );
    RAISE NOTICE 'Deleted boq_line_items records';

    -- Delete BOQ headlines
    DELETE FROM boq_headlines
    WHERE package_id IN (SELECT id FROM packages WHERE site_id = site_uuid);
    RAISE NOTICE 'Deleted boq_headlines records';

    -- Delete packages
    DELETE FROM packages WHERE site_id = site_uuid;
    RAISE NOTICE 'Deleted packages records';

    -- Finally, delete the site
    DELETE FROM sites WHERE id = site_uuid;
    RAISE NOTICE 'Deleted site TCS-Vizag successfully!';

END $$;

-- Verify deletion
SELECT 'Sites remaining:' as info, COUNT(*) as count FROM sites;
