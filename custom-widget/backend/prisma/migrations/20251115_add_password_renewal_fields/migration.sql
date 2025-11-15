-- Add password renewal tracking fields to users table
ALTER TABLE "users" ADD COLUMN "password_changed_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "password_expires_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "password_blocked" BOOLEAN NOT NULL DEFAULT false;

-- Initialize password_changed_at for existing users to their created_at date
-- This gives existing users 180 days from when this migration runs
UPDATE "users" SET "password_changed_at" = NOW();

-- Calculate password_expires_at as 180 days from now for existing users
UPDATE "users" SET "password_expires_at" = NOW() + INTERVAL '180 days';
