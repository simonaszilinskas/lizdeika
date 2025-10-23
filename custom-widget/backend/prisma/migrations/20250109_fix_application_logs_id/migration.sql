-- Drop the old application_logs table and recreate with correct schema
DROP TABLE IF EXISTS application_logs CASCADE;

CREATE TABLE "application_logs" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" TEXT NOT NULL,
    "correlation_id" TEXT,
    "service" TEXT NOT NULL DEFAULT 'vilnius-assistant-backend',
    "module" TEXT,
    "message" TEXT NOT NULL,
    "user_id" TEXT,
    "metadata" JSONB,
    "stack" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "application_logs_timestamp_idx" ON "application_logs"("timestamp");
CREATE INDEX "application_logs_level_idx" ON "application_logs"("level");
CREATE INDEX "application_logs_correlation_id_idx" ON "application_logs"("correlation_id");
CREATE INDEX "application_logs_user_id_idx" ON "application_logs"("user_id");
CREATE INDEX "application_logs_module_idx" ON "application_logs"("module");
CREATE INDEX "application_logs_level_timestamp_idx" ON "application_logs"("level", "timestamp" DESC);
