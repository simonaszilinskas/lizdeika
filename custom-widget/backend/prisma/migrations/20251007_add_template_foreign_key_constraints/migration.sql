-- DropForeignKey (to recreate with new constraints)
ALTER TABLE "response_templates" DROP CONSTRAINT IF EXISTS "response_templates_created_by_fkey";
ALTER TABLE "response_templates" DROP CONSTRAINT IF EXISTS "response_templates_updated_by_fkey";

-- AddForeignKey with onDelete constraints
ALTER TABLE "response_templates" ADD CONSTRAINT "response_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "response_templates" ADD CONSTRAINT "response_templates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
