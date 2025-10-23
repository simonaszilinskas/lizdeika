-- Add missing columns for ticket categorization
ALTER TABLE "tickets" ADD COLUMN "category_id" TEXT;
ALTER TABLE "tickets" ADD COLUMN "category_metadata" JSONB;
ALTER TABLE "tickets" ADD COLUMN "manual_category_override" BOOLEAN NOT NULL DEFAULT false;

-- Create ticket_categories table if it doesn't exist
CREATE TABLE IF NOT EXISTS "ticket_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_categories_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ticket_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX "tickets_category_id_idx" ON "tickets"("category_id");
CREATE INDEX "tickets_manual_category_override_idx" ON "tickets"("manual_category_override");
