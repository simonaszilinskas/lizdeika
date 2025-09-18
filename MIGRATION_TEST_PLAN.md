# Knowledge Base Migration Test Plan

## Overview
This document provides comprehensive testing strategy for migrating the standalone knowledge base functionality into the settings page. All tests focus on API validation through curl requests to ensure embeddings, RAG system, and document processing work correctly.

## Testing Environment
- **Base URL**: http://localhost:3002
- **Authentication**: JWT tokens via `/api/auth/login`
- **Test User**: `admin@vilnius.lt` / `admin123`

## Phase 1: Baseline API Testing

### 1.1 Authentication Test
```bash
# Get authentication token
TOKEN=$(curl -s -X POST "http://localhost:3002/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@vilnius.lt","password":"admin123"}' | jq -r '.token')

echo "Auth Token: $TOKEN"
```

### 1.2 Knowledge Base Stats
```bash
# Test basic stats endpoint
curl -X GET "http://localhost:3002/api/knowledge/stats" \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nStatus: %{http_code}\nTime: %{time_total}s\n"
```

### 1.3 Document Listing
```bash
# Test document listing
curl -X GET "http://localhost:3002/api/knowledge/documents" \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nStatus: %{http_code}\n"
```

### 1.4 Vector Database Status
```bash
# Test indexed documents
curl -X GET "http://localhost:3002/api/knowledge/indexed" \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nStatus: %{http_code}\n"
```

## Phase 2: Document Upload & Processing Tests

### 2.1 Text Document Upload
```bash
# Upload text document
curl -X POST "http://localhost:3002/api/knowledge/documents/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-data/test-document.txt" \
  -w "\nUpload Status: %{http_code}\nTime: %{time_total}s\n"
```

### 2.2 DOCX Document Upload
```bash
# Upload DOCX document (if supported)
curl -X POST "http://localhost:3002/api/knowledge/documents/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-data/test-document.docx" \
  -w "\nUpload Status: %{http_code}\n"
```

### 2.3 Verify Document Processing
```bash
# Wait for processing and check stats
sleep 10
curl -X GET "http://localhost:3002/api/knowledge/stats" \
  -H "Authorization: Bearer $TOKEN" | jq '{documents: .documents, embeddings: .embeddings, status: .status}'
```

## Phase 3: Embeddings & Vector Search Tests (CRITICAL)

### 3.1 Vector Search Test
```bash
# Test semantic search
curl -X GET "http://localhost:3002/api/knowledge/documents/search?q=vilnius+municipal+services" \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nSearch Status: %{http_code}\n" | jq '.results[].content'
```

### 3.2 Multiple Search Queries
```bash
# Test various queries
QUERIES=("municipal assistance" "city services" "permits documentation" "public transportation")

for query in "${QUERIES[@]}"; do
  echo "Testing query: $query"
  curl -X GET "http://localhost:3002/api/knowledge/documents/search?q=$query" \
    -H "Authorization: Bearer $TOKEN" \
    -w "\nQuery '$query' Status: %{http_code}\n" | jq '.results | length'
  echo "---"
done
```

### 3.3 Verify Embeddings Generation
```bash
# Check embeddings count and quality
curl -X GET "http://localhost:3002/api/knowledge/indexed" \
  -H "Authorization: Bearer $TOKEN" | jq '.documents[] | {id: .id, embeddings: .embeddings_count, chunks: .chunks}'
```

## Phase 4: AI Integration & RAG System Tests (CRITICAL)

### 4.1 Create Test Conversation
```bash
# Create conversation for AI testing
CONVERSATION_ID=$(curl -s -X POST "http://localhost:3002/api/conversations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test-user","subject":"Test RAG System"}' | jq -r '.id')

echo "Conversation ID: $CONVERSATION_ID"
```

### 4.2 Send Message Requiring Knowledge Base
```bash
# Send message that should trigger RAG
curl -X POST "http://localhost:3002/api/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"conversation_id\":\"$CONVERSATION_ID\",\"content\":\"How can I get municipal services in Vilnius? What permits do I need?\",\"sender_type\":\"customer\"}" \
  -w "\nMessage Status: %{http_code}\n"
```

### 4.3 Wait and Check AI Suggestion
```bash
# Wait for AI processing
echo "Waiting for AI suggestion generation..."
sleep 15

# Check for AI suggestion with context
curl -X GET "http://localhost:3002/api/conversations/$CONVERSATION_ID/ai-suggestion" \
  -H "Authorization: Bearer $TOKEN" | jq '{suggestion: .suggestion, context_used: .context_used, has_context: (.context_used != null)}'
```

### 4.4 Validate RAG Context Usage
```bash
# Verify that context from knowledge base is used
curl -X GET "http://localhost:3002/api/conversations/$CONVERSATION_ID/messages" \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | select(.senderType == "ai") | {content: .content, metadata: .metadata}'
```

## Phase 5: Performance & Load Tests

### 5.1 Bulk Upload Test
```bash
# Upload multiple documents simultaneously
echo "Starting bulk upload test..."
for i in {1..3}; do
  curl -X POST "http://localhost:3002/api/knowledge/documents/upload" \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@test-data/test-doc-$i.txt" \
    -w "Upload $i Status: %{http_code} Time: %{time_total}s\n" &
done
wait
echo "Bulk upload completed"
```

### 5.2 Concurrent Search Tests
```bash
# Test concurrent searches
echo "Starting concurrent search test..."
for i in {1..5}; do
  curl -s -X GET "http://localhost:3002/api/knowledge/documents/search?q=test+query+$i" \
    -H "Authorization: Bearer $TOKEN" \
    -w "Search $i Time: %{time_total}s\n" &
done
wait
echo "Concurrent search completed"
```

### 5.3 System Health Check
```bash
# Verify system health after load
curl -X GET "http://localhost:3002/api/health" \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nHealth Status: %{http_code}\n"
```

## Phase 6: Error Handling & Edge Cases

### 6.1 Invalid File Upload
```bash
# Test invalid file type
echo "invalid content" > test-data/invalid.xyz
curl -X POST "http://localhost:3002/api/knowledge/documents/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-data/invalid.xyz" \
  -w "\nInvalid Upload Status: %{http_code}\n"
```

### 6.2 Empty Search Query
```bash
# Test empty search
curl -X GET "http://localhost:3002/api/knowledge/documents/search?q=" \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nEmpty Search Status: %{http_code}\n"
```

### 6.3 Invalid Document Operations
```bash
# Test invalid document ID
curl -X GET "http://localhost:3002/api/knowledge/documents/invalid-id-123" \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nInvalid ID Status: %{http_code}\n"

# Test delete non-existent document
curl -X DELETE "http://localhost:3002/api/knowledge/documents/invalid-id-123" \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nDelete Invalid Status: %{http_code}\n"
```

## Expected Results

### Success Criteria
- [ ] All API endpoints return appropriate HTTP status codes (200, 201, 404, 400)
- [ ] Document uploads process successfully (status 201)
- [ ] Embeddings generate within 30 seconds of upload
- [ ] Vector search returns relevant results with similarity scores
- [ ] AI suggestions include context from uploaded documents
- [ ] Search performance under 2 seconds for typical queries
- [ ] System remains stable under concurrent load
- [ ] Error handling returns appropriate error messages

### Performance Benchmarks
- Document upload: < 5 seconds for files under 1MB
- Embedding generation: < 30 seconds per document
- Vector search: < 2 seconds per query
- AI suggestion with RAG: < 15 seconds
- Concurrent operations: No degradation with up to 5 simultaneous requests

### RAG System Validation
- **CRITICAL**: AI suggestions must include relevant context from uploaded documents
- **CRITICAL**: Vector search must return semantically similar content
- **CRITICAL**: Embeddings must be generated and stored correctly
- **CRITICAL**: Knowledge base integration must work with both Flowise and OpenRouter

## Test Data Requirements
- Multiple text files with Vilnius municipal content
- Different file formats (.txt, .docx if supported)
- Various query types (exact match, semantic similarity, complex questions)
- Files of different sizes (small, medium, large)

## Troubleshooting
If tests fail, check:
1. Server logs in backend console
2. Vector database connectivity (ChromaDB)
3. AI provider configuration
4. Authentication token validity
5. File upload limits and permissions

This test plan ensures comprehensive validation of all knowledge base functionality before, during, and after the migration process.