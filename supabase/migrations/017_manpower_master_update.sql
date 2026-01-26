-- Migration: Update Manpower Master with new fields
-- Adds contractor_name, gender, daily_hours fields and renames hourly_rate to rate

-- Add new columns
ALTER TABLE master_manpower
ADD COLUMN IF NOT EXISTS contractor_name TEXT;

ALTER TABLE master_manpower
ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'any' CHECK (gender IN ('male', 'female', 'any'));

ALTER TABLE master_manpower
ADD COLUMN IF NOT EXISTS daily_hours DECIMAL(4,2) DEFAULT 8;

-- Rename hourly_rate to rate (if it exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'master_manpower' AND column_name = 'hourly_rate'
    ) THEN
        ALTER TABLE master_manpower RENAME COLUMN hourly_rate TO rate;
    END IF;
END $$;

-- Add rate column if it doesn't exist (in case rename didn't happen)
ALTER TABLE master_manpower
ADD COLUMN IF NOT EXISTS rate DECIMAL(10,2) DEFAULT 0;

-- Create index on contractor_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_master_manpower_contractor ON master_manpower(contractor_name);
