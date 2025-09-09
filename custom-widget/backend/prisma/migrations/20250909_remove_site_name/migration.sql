-- Remove site_name setting from system_settings table
DELETE FROM "system_settings" WHERE "setting_key" = 'site_name';