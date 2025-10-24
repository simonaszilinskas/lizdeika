-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" TEXT NOT NULL,
    "source_url" TEXT,
    "title" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "source_type" TEXT NOT NULL DEFAULT 'manual_upload',
    "status" TEXT NOT NULL DEFAULT 'indexed',
    "chunks_count" INTEGER NOT NULL DEFAULT 0,
    "total_chars" INTEGER NOT NULL DEFAULT 0,
    "chroma_ids" JSONB,
    "file_path" TEXT,
    "size" INTEGER,
    "error_message" TEXT,
    "metadata" JSONB,
    "last_updated" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "indexed_at" TIMESTAMP(3),

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_documents_source_url_key" ON "knowledge_documents"("source_url");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_documents_content_hash_key" ON "knowledge_documents"("content_hash");

-- CreateIndex
CREATE INDEX "knowledge_documents_source_type_idx" ON "knowledge_documents"("source_type");

-- CreateIndex
CREATE INDEX "knowledge_documents_status_idx" ON "knowledge_documents"("status");

-- CreateIndex
CREATE INDEX "knowledge_documents_created_at_idx" ON "knowledge_documents"("created_at");
