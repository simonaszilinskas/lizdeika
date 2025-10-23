-- Backup existing data if any
CREATE TABLE IF NOT EXISTS system_settings_backup AS SELECT * FROM system_settings;

-- Drop the old constraints
ALTER TABLE system_settings DROP CONSTRAINT IF EXISTS system_settings_key_key;

-- Add new columns with defaults
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS "setting_key" TEXT;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS "setting_value" TEXT;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS "setting_type" TEXT DEFAULT 'string';
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT 'general';
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS "is_public" BOOLEAN DEFAULT false;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- Migrate data from old columns to new ones
UPDATE system_settings SET setting_key = key, setting_value = value WHERE setting_key IS NULL AND key IS NOT NULL;

-- Drop old columns
ALTER TABLE system_settings DROP COLUMN IF EXISTS "key";
ALTER TABLE system_settings DROP COLUMN IF EXISTS "value";

-- Make new columns NOT NULL
ALTER TABLE system_settings ALTER COLUMN "setting_key" SET NOT NULL;
ALTER TABLE system_settings ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE system_settings ALTER COLUMN "updated_by" DROP NOT NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS system_settings_category_idx ON system_settings(category);
CREATE INDEX IF NOT EXISTS system_settings_is_public_idx ON system_settings(is_public);
CREATE INDEX IF NOT EXISTS system_settings_setting_key_category_idx ON system_settings(setting_key, category);
CREATE UNIQUE INDEX IF NOT EXISTS system_settings_setting_key_key ON system_settings(setting_key);
