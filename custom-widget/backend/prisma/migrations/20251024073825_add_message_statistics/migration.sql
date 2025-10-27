/*
  Warnings:

  - You are about to drop the `system_settings_backup` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `setting_type` on table `system_settings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `category` on table `system_settings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_public` on table `system_settings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `system_settings` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "SuggestionAction" AS ENUM ('sent_as_is', 'edited', 'from_scratch');

-- CreateEnum
CREATE TYPE "SystemMode" AS ENUM ('hitl', 'autopilot', 'off');

-- AlterTable
ALTER TABLE "system_settings" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "setting_type" SET NOT NULL,
ALTER COLUMN "category" SET NOT NULL,
ALTER COLUMN "is_public" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL;

-- DropTable
DROP TABLE "system_settings_backup";

-- CreateTable
CREATE TABLE "message_statistics" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "ai_suggestion_used" BOOLEAN NOT NULL DEFAULT false,
    "suggestion_action" "SuggestionAction",
    "suggestion_edit_ratio" DOUBLE PRECISION,
    "original_suggestion" TEXT,
    "template_used" BOOLEAN NOT NULL DEFAULT false,
    "template_id" TEXT,
    "system_mode" "SystemMode" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "message_statistics_message_id_key" ON "message_statistics"("message_id");

-- CreateIndex
CREATE INDEX "message_statistics_agent_id_idx" ON "message_statistics"("agent_id");

-- CreateIndex
CREATE INDEX "message_statistics_ticket_id_idx" ON "message_statistics"("ticket_id");

-- CreateIndex
CREATE INDEX "message_statistics_template_id_idx" ON "message_statistics"("template_id");

-- CreateIndex
CREATE INDEX "message_statistics_created_at_idx" ON "message_statistics"("created_at");

-- CreateIndex
CREATE INDEX "message_statistics_ai_suggestion_used_idx" ON "message_statistics"("ai_suggestion_used");

-- CreateIndex
CREATE INDEX "message_statistics_suggestion_action_idx" ON "message_statistics"("suggestion_action");

-- CreateIndex
CREATE INDEX "message_statistics_system_mode_idx" ON "message_statistics"("system_mode");

-- CreateIndex
CREATE INDEX "name_search" ON "ticket_categories"("name");

-- AddForeignKey
ALTER TABLE "message_statistics" ADD CONSTRAINT "message_statistics_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_statistics" ADD CONSTRAINT "message_statistics_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_statistics" ADD CONSTRAINT "message_statistics_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_statistics" ADD CONSTRAINT "message_statistics_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "response_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "ticket_categories_archived_lookup_idx" RENAME TO "archived_lookup";

-- RenameIndex
ALTER INDEX "ticket_categories_created_by_idx" RENAME TO "creator_lookup";
