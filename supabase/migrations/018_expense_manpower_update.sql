-- Migration: Update Expense Manpower with new fields
-- Adds contractor_name, gender, num_persons, start_time, end_time fields
-- Calculation: total_hours = (end_time - start_time), amount = hourly_rate * total_hours * num_persons

-- Add new columns
ALTER TABLE expense_manpower
ADD COLUMN IF NOT EXISTS contractor_name TEXT;

ALTER TABLE expense_manpower
ADD COLUMN IF NOT EXISTS gender TEXT;

ALTER TABLE expense_manpower
ADD COLUMN IF NOT EXISTS num_persons INTEGER DEFAULT 1;

ALTER TABLE expense_manpower
ADD COLUMN IF NOT EXISTS start_time TIME;

ALTER TABLE expense_manpower
ADD COLUMN IF NOT EXISTS end_time TIME;

-- Create index on contractor_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_expense_manpower_contractor ON expense_manpower(contractor_name);
