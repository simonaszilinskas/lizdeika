-- Create ticket_categories table with full schema matching Prisma model
CREATE TABLE IF NOT EXISTS "ticket_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL UNIQUE,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "created_by" TEXT NOT NULL,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "ticket_categories_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints for ticket_categories
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_updated_by_fkey"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add missing columns for ticket categorization
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "category_id" TEXT;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "category_metadata" JSONB;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "manual_category_override" BOOLEAN NOT NULL DEFAULT false;

-- Add foreign key constraint from tickets to ticket_categories
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ticket_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes for ticket_categories
CREATE INDEX IF NOT EXISTS "ticket_categories_archived_lookup_idx" ON "ticket_categories"("is_archived");
CREATE INDEX IF NOT EXISTS "ticket_categories_created_by_idx" ON "ticket_categories"("created_by");

-- Add indexes for tickets
CREATE INDEX IF NOT EXISTS "tickets_category_id_idx" ON "tickets"("category_id");
CREATE INDEX IF NOT EXISTS "tickets_manual_category_override_idx" ON "tickets"("manual_category_override");
