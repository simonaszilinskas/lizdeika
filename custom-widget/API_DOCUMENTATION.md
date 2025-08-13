# Vilnius Assistant - API Documentation

## Document Indexing API

The Vilnius Assistant provides REST API endpoints for indexing documents directly with metadata, enabling integration with external systems for knowledge base management.

## Authentication

Currently, the API does not require authentication. In production, consider adding API key authentication or other security measures.

## Base URL

```
http://localhost:3002/api/knowledge
```

## Endpoints

### 1. Index Single Document

**Endpoint:** `POST /documents/index`

**Description:** Index a single document with metadata directly via API.

**Request Body:**
```json
{
  "content": "Document text content to be indexed",
  "metadata": {
    "title": "Document Title",
    "sourceUrl": "https://vilnius.lt/example-page",
    "category": "FAQ",
    "tags": ["vilnius", "registration", "services"],
    "language": "lt",
    "lastUpdated": "2024-01-15T10:30:00Z"
  }
}
```

**Required Fields:**
- `content` (string): The text content to be indexed

**Optional Metadata Fields:**
- `title` (string): Document title (default: "API Document")
- `sourceUrl` (string): Source URL for citation purposes
- `category` (string): Document category (default: "general")
- `tags` (array): Array of tags for categorization
- `language` (string): Document language code (default: "lt")
- `lastUpdated` (string): ISO 8601 timestamp of last update

**Response:**
```json
{
  "success": true,
  "message": "Document indexed successfully",
  "data": {
    "documentId": "uuid-here",
    "chunksCount": 3,
    "status": "indexed",
    "metadata": {
      "source_document_name": "Document Title",
      "source_url": "https://vilnius.lt/example-page",
      "category": "FAQ",
      "tags": ["vilnius", "registration", "services"],
      "language": "lt",
      "content_type": "api_indexed",
      "upload_timestamp": "2024-01-15T10:30:00.000Z",
      "last_updated": "2024-01-15T10:30:00Z"
    }
  }
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3002/api/knowledge/documents/index \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Vilniaus miesto bibliotekos kortelės išdavimas yra nemokamas. Kortelę galite gauti bet kurioje miesto bibliotekoje pateikus asmens dokumentą.",
    "metadata": {
      "title": "Bibliotekos kortelės informacija",
      "sourceUrl": "https://vilnius.lt/bibliotekos",
      "category": "Bibliotekos",
      "tags": ["biblioteka", "kortelė", "registracija"],
      "language": "lt"
    }
  }'
```

### 2. Index Multiple Documents (Batch)

**Endpoint:** `POST /documents/index-batch`

**Description:** Index multiple documents in a single request.

**Request Body:**
```json
{
  "documents": [
    {
      "content": "First document content",
      "metadata": {
        "title": "Document 1",
        "sourceUrl": "https://vilnius.lt/doc1",
        "category": "FAQ"
      }
    },
    {
      "content": "Second document content",
      "metadata": {
        "title": "Document 2",
        "sourceUrl": "https://vilnius.lt/doc2",
        "category": "Services"
      }
    }
  ]
}
```

**Limits:**
- Maximum 100 documents per batch
- Each document must have content

**Response:**
```json
{
  "success": true,
  "message": "Batch indexing completed: 2 successful, 0 failed",
  "data": {
    "successful": [
      {
        "index": 0,
        "documentId": "uuid-1",
        "chunksCount": 2,
        "status": "indexed",
        "metadata": { ... }
      },
      {
        "index": 1,
        "documentId": "uuid-2", 
        "chunksCount": 3,
        "status": "indexed",
        "metadata": { ... }
      }
    ],
    "failed": [],
    "summary": {
      "total": 2,
      "successful": 2,
      "failed": 0
    }
  }
}
```

### 3. List All Documents

**Endpoint:** `GET /documents`

**Description:** Retrieve list of all indexed documents.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-here",
      "originalName": "Document Title",
      "fileType": "text/plain",
      "size": 1024,
      "uploadSource": "api",
      "uploadTime": "2024-01-15T10:30:00.000Z",
      "chunksCount": 3,
      "textLength": 850,
      "status": "indexed",
      "indexedAt": "2024-01-15T10:30:05.000Z",
      "metadata": { ... }
    }
  ],
  "count": 1
}
```

### 4. Get Document Details

**Endpoint:** `GET /documents/:documentId`

**Description:** Retrieve details for a specific document.

### 5. Delete Document

**Endpoint:** `DELETE /documents/:documentId`

**Description:** Remove a document from the knowledge base.

### 6. Search Documents

**Endpoint:** `GET /documents/search?q=query`

**Description:** Search documents by text query.

### 7. Knowledge Base Statistics

**Endpoint:** `GET /stats`

**Description:** Get knowledge base statistics and metrics.

## Integration Examples

### Web Scraping Integration

```javascript
// Example: Scrape and index web pages
async function indexWebPage(url) {
  const response = await fetch(url);
  const html = await response.text();
  const content = extractTextFromHtml(html); // Your HTML parsing logic
  
  const indexResponse = await fetch('http://localhost:3002/api/knowledge/documents/index', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: content,
      metadata: {
        title: extractTitle(html),
        sourceUrl: url,
        category: 'Web Page',
        tags: ['vilnius', 'official'],
        language: 'lt',
        lastUpdated: new Date().toISOString()
      }
    })
  });
  
  return await indexResponse.json();
}
```

### CMS Integration

```javascript
// Example: Index CMS content
async function indexCMSContent(cmsArticle) {
  return await fetch('http://localhost:3002/api/knowledge/documents/index', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: cmsArticle.content,
      metadata: {
        title: cmsArticle.title,
        sourceUrl: cmsArticle.url,
        category: cmsArticle.category,
        tags: cmsArticle.tags,
        language: cmsArticle.language,
        lastUpdated: cmsArticle.updatedAt
      }
    })
  });
}
```

## Source Citation in Responses

When documents include `sourceUrl` metadata, the AI assistant will automatically include source citations in responses:

**Example Response:**
```
Bibliotekos kortelės išdavimas yra nemokamas. Kortelę galite gauti bet kurioje miesto bibliotekoje pateikus asmens dokumentą.

Daugiau informacijos: https://vilnius.lt/bibliotekos
```

## Error Handling

**Error Response Format:**
```json
{
  "error": "Error message",
  "details": "Additional error details"
}
```

**Common Error Codes:**
- `400` - Bad Request (missing content, invalid format)
- `500` - Internal Server Error (processing failure)

## Best Practices

### 1. Metadata Recommendations

**Always Include:**
- `title` - Clear, descriptive document title
- `sourceUrl` - For proper citation and verification
- `category` - For better organization
- `language` - For bilingual support

**Example Good Metadata:**
```json
{
  "title": "Mokyklų registracija 2024",
  "sourceUrl": "https://vilnius.lt/education/registration", 
  "category": "Švietimas",
  "tags": ["mokykla", "registracija", "vaikai"],
  "language": "lt",
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

### 2. Content Preparation

- **Clean Text**: Remove HTML tags, formatting artifacts
- **Structured Content**: Use clear headings and paragraphs
- **Complete Information**: Include context, not just fragments
- **Language Consistency**: Match content language with metadata

### 3. Batch Processing

- **Optimal Batch Size**: 10-50 documents per batch
- **Error Handling**: Check both successful and failed results
- **Rate Limiting**: Allow time between large batch operations

### 4. URL Management

- **Persistent URLs**: Use permanent links that won't break
- **Deep Links**: Link to specific sections when possible
- **HTTPS**: Use secure URLs for official content

## Vector Database Details

- **Embedding Model**: Mistral-embed (1024 dimensions)
- **Vector Database**: Chroma DB Cloud
- **Similarity Search**: Cosine similarity
- **Chunking**: Automatic text chunking for optimal retrieval
- **Language Support**: Lithuanian and English

## Production Considerations

1. **Authentication**: Add API key or token authentication
2. **Rate Limiting**: Implement request rate limiting
3. **Input Validation**: Validate content size and format
4. **Monitoring**: Log API usage and errors
5. **Backup**: Regular vector database backups
6. **Caching**: Cache frequently accessed documents

---

This API enables seamless integration of the Vilnius Assistant with external content management systems, web scrapers, and automated content pipelines while maintaining proper source attribution for transparent AI responses.