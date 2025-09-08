-- AlterTable
ALTER TABLE "system_settings" DROP COLUMN "key",
DROP COLUMN "value",
ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'general',
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "is_public" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "setting_key" TEXT NOT NULL,
ADD COLUMN     "setting_type" TEXT NOT NULL DEFAULT 'string',
ADD COLUMN     "setting_value" TEXT,
ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
ALTER COLUMN "updated_by" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "system_settings_category_idx" ON "system_settings"("category");

-- CreateIndex
CREATE INDEX "system_settings_is_public_idx" ON "system_settings"("is_public");

-- CreateIndex
CREATE INDEX "system_settings_setting_key_category_idx" ON "system_settings"("setting_key", "category");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_setting_key_key" ON "system_settings"("setting_key");

-- Insert default branding settings
INSERT INTO "system_settings" (setting_key, setting_value, setting_type, description, category, is_public) VALUES
('widget_name', 'Vilnius Assistant', 'string', 'Display name for the chat widget', 'branding', true),
('widget_primary_color', '#2c5530', 'string', 'Primary color for the chat widget (hex format)', 'branding', true),
('site_name', 'Vilniaus chatbot', 'string', 'Name of the website/organization', 'branding', true),
('widget_allowed_domains', '*', 'string', 'Comma-separated list of domains where the widget can be embedded', 'branding', false);