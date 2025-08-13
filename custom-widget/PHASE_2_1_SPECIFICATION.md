# Phase 2.1 Implementation Specification

## Overview

This document outlines the implementation plan for Phase 2.1 enhancements to the Vilnius Assistant RAG system, focusing on intelligent chunking, structured markdown output, flexible input format, and duplicate management.

## 🎯 Core Improvements

### 1. Flexible Input Format

**API Input Structure:**
```json
{
  "body": "Full document content...",        // REQUIRED ONLY
  "title": "Document Title",                 // OPTIONAL - auto-generated if missing
  "sourceUrl": "https://vilnius.lt/page",   // OPTIONAL - null if not provided
  "date": "2024-01-15T10:30:00Z"           // OPTIONAL - current date if missing
}
```

**Auto-generation Rules:**
- **Missing title:** Use first 50 characters of body + "..."
- **Missing date:** Use current timestamp (new Date().toISOString())
- **Missing sourceUrl:** Store as null, skip from citations

### 2. Enhanced Chunking Algorithm

**Current Issues:**
- Small chunks (1000 chars) lose context
- Arbitrary sentence splitting breaks meaning
- No phrase-boundary awareness

**New Algorithm:**
```javascript
const CHUNK_SIZE = 3000;     // Target chunk size
const MIN_CHUNK_SIZE = 1500; // Minimum viable chunk
const OVERLAP_SIZE = 300;    // Overlap between chunks

// Phrase-Aware Splitting Priority:
1. Paragraph boundaries (\n\n) - HIGHEST PRIORITY
2. Sentence boundaries (. ! ?) 
3. Clause boundaries (, ; :)
4. Never split within quotes ("..." or '...')
5. Never split within parentheses (...)
6. Never split URLs or email addresses
7. Never split words - LOWEST PRIORITY
```

### 3. Structured Markdown Output (No Internal Lines)

**Context Template for LLM:**
```markdown
---
title: "Document Title"
source: "https://vilnius.lt/page"
date: "2024-01-15"
chunk: "1 of 3"
---

# Document Title

**Šaltinis:** https://vilnius.lt/page  
**Data:** 2024-01-15  
**Dalis:** 1 iš 3

Document content chunk here flowing naturally without any internal separator lines, maintaining readability and context while providing complete information for the AI to understand and use appropriately.

---
title: "Document Title"
source: "https://vilnius.lt/page"
date: "2024-01-15" 
chunk: "2 of 3"
---

# Document Title

**Šaltinis:** https://vilnius.lt/page  
**Data:** 2024-01-15  
**Dalis:** 2 iš 3

Continuation of content maintaining the natural flow and providing context overlap to ensure coherent understanding across chunk boundaries.
```

**Key Rules:**
- `---` metadata separators only between different chunks
- NO separator lines within chunk content
- Clean, natural content flow within each chunk
- Structured headers for AI parsing

### 4. Duplicate Detection & Version Management

**Detection Strategy:**

1. **Primary:** `sourceUrl` exact match (when provided)
2. **Secondary:** `title` exact match (when both have titles)
3. **Fallback:** First 100 characters of body content match

**Replacement Rules:**
- **"newer"** (default): Replace if new date > existing date
- **"always"**: Always replace existing content
- **"never"**: Keep existing, reject new

### 5. API Endpoint Updates

#### Enhanced Single Document Endpoint

**Endpoint:** `POST /api/knowledge/documents/index`

**Request Body:**
```json
{
  "body": "Vilniaus miesto savivaldybės gyventojų aptarnavimo centras teikia...",
  "title": "Gyventojų aptarnavimo centras",
  "sourceUrl": "https://vilnius.lt/aptarnavimas",
  "date": "2024-01-15T10:30:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Document indexed successfully",
  "data": {
    "documentId": "uuid",
    "title": "Gyventojų aptarnavimo centras",
    "sourceUrl": "https://vilnius.lt/aptarnavimas", 
    "date": "2024-01-15T10:30:00Z",
    "chunksCount": 2,
    "totalLength": 4500,
    "status": "indexed",
    "replacedDocument": null,
    "generatedTitle": false
  }
}
```

#### Enhanced Batch Endpoint

**No changes to structure, but updated processing:**
- Apply new chunking algorithm
- Use flexible input validation
- Implement duplicate detection
- Generate missing fields automatically

## 📋 Implementation Tasks

### Task 1: Enhanced Chunking Service
**File:** `backend/src/services/documentService.js`

**Updates:**
- Implement intelligent chunking algorithm
- Add phrase-boundary awareness
- Increase chunk size to 3000 characters
- Ensure minimum overlap between chunks

### Task 2: Structured Markdown Formatting  
**File:** `backend/src/services/langchainRAG.js`

**Updates:**
- Format retrieved chunks with markdown headers
- Include metadata in structured format
- Remove internal separator lines
- Ensure clean content flow

### Task 3: Flexible Input Validation
**File:** `backend/src/controllers/knowledgeController.js`

**Updates:**
- Make only `body` field required
- Auto-generate missing title from content
- Default missing date to current timestamp  
- Handle optional sourceUrl gracefully

### Task 4: Duplicate Detection System
**File:** `backend/src/services/knowledgeManagerService.js`

**Updates:**
- Implement multi-level duplicate detection
- Add version comparison logic
- Handle replacement scenarios
- Track replaced document relationships

### Task 5: Database Schema Updates
**Files:** Vector database metadata

**Updates:**
- Store generated vs provided titles
- Track replacement relationships
- Handle null sourceUrl values
- Maintain version history

### Task 6: Admin Interface Standardization
**File:** `admin-settings.html`

**Updates:**  
- Update upload form for flexible input
- Apply same chunking to uploaded files
- Show generated vs provided metadata
- Preview formatted chunks

## 🧪 Testing Strategy

### Unit Tests
- Chunking algorithm with various content types
- Markdown formatting with edge cases
- Duplicate detection accuracy
- Auto-generation of missing fields

### Integration Tests  
- End-to-end API workflows
- Batch processing with mixed input formats
- Vector database operations
- Admin interface functionality

### Performance Tests
- Large document chunking speed
- Batch processing scalability
- Duplicate detection efficiency
- Memory usage with large content

## 📊 Success Metrics

**Quality Improvements:**
- ✅ Chunks average 2500-3000 characters
- ✅ No broken phrases across chunk boundaries
- ✅ Structured markdown format in 100% of chunks
- ✅ Auto-generated titles for missing metadata

**Functionality:**
- ✅ Flexible API accepts body-only requests
- ✅ Duplicate detection prevents content redundancy
- ✅ Version management handles updates correctly
- ✅ Admin interface shows formatted chunks

**Performance:**
- ✅ Chunking processes 1MB documents in <5 seconds
- ✅ Batch operations handle 1000+ documents efficiently
- ✅ Duplicate detection completes in <100ms per document
- ✅ Memory usage remains stable during large operations

## 🗓️ Implementation Timeline

**Week 1: Core Algorithm Development**
- Enhanced chunking algorithm
- Markdown formatting system
- Flexible input validation

**Week 2: Duplicate Detection & Version Management** 
- Multi-level duplicate detection
- Version comparison and replacement
- Database schema updates

**Week 3: API Integration & Testing**
- Updated API endpoints  
- Comprehensive testing suite
- Performance optimization

**Week 4: Admin Interface & Documentation**
- Updated admin interface
- User documentation
- API documentation updates

## 🔧 Technical Implementation Details

### Enhanced Chunking Algorithm Implementation

```javascript
class EnhancedDocumentChunker {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 3000;
    this.minChunkSize = options.minChunkSize || 1500;
    this.overlapSize = options.overlapSize || 300;
  }

  chunkText(text, documentInfo) {
    // 1. Clean and normalize text
    const cleanText = this.normalizeText(text);
    
    // 2. Identify phrase boundaries
    const boundaries = this.findPhraseBoundaries(cleanText);
    
    // 3. Create chunks respecting boundaries
    const chunks = this.createPhraseMindfulChunks(cleanText, boundaries);
    
    // 4. Format as structured markdown
    return chunks.map((chunk, index) => 
      this.formatChunkAsMarkdown(chunk, documentInfo, index, chunks.length)
    );
  }

  findPhraseBoundaries(text) {
    // Find safe splitting points in order of preference
    const paragraphs = this.findParagraphBoundaries(text);
    const sentences = this.findSentenceBoundaries(text);  
    const clauses = this.findClauseBoundaries(text);
    
    return { paragraphs, sentences, clauses };
  }

  formatChunkAsMarkdown(chunk, documentInfo, index, total) {
    const title = documentInfo.title || this.generateTitle(documentInfo.body);
    const sourceUrl = documentInfo.sourceUrl || null;
    const date = documentInfo.date || new Date().toISOString().split('T')[0];
    
    return `---
title: "${title}"
source: ${sourceUrl ? `"${sourceUrl}"` : 'null'}
date: "${date}"
chunk: "${index + 1} of ${total}"
---

# ${title}

${sourceUrl ? `**Šaltinis:** ${sourceUrl}` : ''}  
**Data:** ${date}  
**Dalis:** ${index + 1} iš ${total}

${chunk.content}`;
  }
}
```

### Duplicate Detection Implementation

```javascript
class DuplicateDetectionService {
  async findDuplicates(newDocument) {
    // 1. URL-based detection (highest priority)
    if (newDocument.sourceUrl) {
      const urlMatch = await this.findBySourceUrl(newDocument.sourceUrl);
      if (urlMatch) return { type: 'url', document: urlMatch };
    }
    
    // 2. Title-based detection
    if (newDocument.title) {
      const titleMatch = await this.findByExactTitle(newDocument.title);
      if (titleMatch) return { type: 'title', document: titleMatch };
    }
    
    // 3. Content-based detection (fallback)
    const contentPreview = newDocument.body.substring(0, 100);
    const contentMatch = await this.findByContentPreview(contentPreview);
    if (contentMatch) return { type: 'content', document: contentMatch };
    
    return null; // No duplicate found
  }

  async shouldReplace(existing, newDoc, mode = 'newer') {
    switch (mode) {
      case 'always': return true;
      case 'never': return false;
      case 'newer': 
      default:
        const existingDate = new Date(existing.date);
        const newDate = new Date(newDoc.date);
        return newDate > existingDate;
    }
  }
}
```

---

**This specification provides a complete blueprint for implementing Phase 2.1 enhancements with intelligent chunking, flexible input handling, structured markdown output, and robust duplicate management while maintaining high performance and user experience.**