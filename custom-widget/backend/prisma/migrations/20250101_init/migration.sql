-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('created', 'assigned', 'priority_changed', 'message_added');

-- CreateEnum
CREATE TYPE "AgentStatusEnum" AS ENUM ('online', 'busy', 'offline');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('text', 'file', 'system_action', 'ai_response');

-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('user', 'agent', 'system', 'ai');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "TicketSource" AS ENUM ('widget', 'admin_panel', 'email');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'agent', 'user');

-- CreateEnum
CREATE TYPE "UserActivityType" AS ENUM ('auth', 'user_management', 'conversation', 'system', 'profile', 'security');

-- CreateTable
CREATE TABLE "agent_status" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "AgentStatusEnum" NOT NULL DEFAULT 'offline',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "sender_id" TEXT,
    "senderType" "SenderType" NOT NULL,
    "content" TEXT NOT NULL,
    "message_type" "MessageType" NOT NULL DEFAULT 'text',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_activities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action_type" "UserActivityType" NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "resource_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "details" JSONB,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_actions" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "performed_by" TEXT NOT NULL,
    "action" "ActionType" NOT NULL,
    "previous_value" TEXT,
    "new_value" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "ticket_number" TEXT NOT NULL,
    "user_id" TEXT,
    "assigned_agent_id" TEXT,
    "user_number" INTEGER,
    "priority" "TicketPriority" NOT NULL DEFAULT 'medium',
    "category" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "source" "TicketSource" NOT NULL DEFAULT 'widget',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "last_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_number" INTEGER,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_status_user_id_key" ON "agent_status"("user_id");

-- CreateIndex
CREATE INDEX "messages_created_at_idx" ON "messages"("created_at");

-- CreateIndex
CREATE INDEX "messages_senderType_idx" ON "messages"("senderType");

-- CreateIndex
CREATE INDEX "messages_ticket_id_created_at_idx" ON "messages"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_ticket_id_idx" ON "messages"("ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "system_logs_created_at_idx" ON "system_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "user_activities_user_id_idx" ON "user_activities"("user_id");

-- CreateIndex
CREATE INDEX "user_activities_action_type_idx" ON "user_activities"("action_type");

-- CreateIndex
CREATE INDEX "user_activities_created_at_idx" ON "user_activities"("created_at");

-- CreateIndex
CREATE INDEX "user_activities_success_idx" ON "user_activities"("success");

-- CreateIndex
CREATE INDEX "ticket_actions_created_at_idx" ON "ticket_actions"("created_at");

-- CreateIndex
CREATE INDEX "ticket_actions_ticket_id_idx" ON "ticket_actions"("ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticket_number_key" ON "tickets"("ticket_number");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_user_number_key" ON "tickets"("user_number");

-- CreateIndex
CREATE INDEX "tickets_assigned_agent_id_idx" ON "tickets"("assigned_agent_id");

-- CreateIndex
CREATE INDEX "tickets_created_at_idx" ON "tickets"("created_at");

-- CreateIndex
CREATE INDEX "tickets_archived_idx" ON "tickets"("archived");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_user_number_key" ON "users"("user_number");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE INDEX "users_last_login_idx" ON "users"("last_login");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- AddForeignKey
ALTER TABLE "agent_status" ADD CONSTRAINT "agent_status_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_actions" ADD CONSTRAINT "ticket_actions_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_actions" ADD CONSTRAINT "ticket_actions_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigned_agent_id_fkey" FOREIGN KEY ("assigned_agent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
