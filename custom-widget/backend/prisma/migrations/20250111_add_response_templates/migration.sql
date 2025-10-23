-- Create response_templates table with full schema
CREATE TABLE IF NOT EXISTS "response_templates" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "response_templates_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "response_templates" ADD CONSTRAINT "response_templates_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "response_templates" ADD CONSTRAINT "response_templates_updated_by_fkey"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS "response_templates_is_active_idx" ON "response_templates"("is_active");
CREATE INDEX IF NOT EXISTS "response_templates_created_by_idx" ON "response_templates"("created_by");
