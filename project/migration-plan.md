# Migration Plan: From Current System to Lizdeika

This document outlines a smooth, phased migration from our current Flowise-based chat system to the full Lizdeika platform without ever breaking existing functionality.

## Philosophy
- **Never break anything** - Flowise always works as fallback
- **Gradual enhancement** - each phase adds value independently  
- **Risk-free deployment** - can rollback any feature
- **Progressive testing** - validate each component before moving forward

---

## Phase 1: Dual AI Backend Support
**Goal**: Add OpenRouter alongside Flowise without breaking anything

### Tasks:
1. **Add OpenRouter integration** as an alternative to Flowise
2. **Environment toggle** - `AI_PROVIDER=flowise|openrouter|both`
3. **System prompt support** for OpenRouter responses
4. **Keep all existing UI/UX exactly the same**

### Technical Details:
- Create `AIProvider` abstraction layer
- Add Gemini 2.5 Flash via OpenRouter API
- Environment variables: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`
- Maintain existing WebSocket/HTTP architecture

### Success Criteria:
- The developer can toggle between the solution used via env variables
- All existing functionality works unchanged

---

## Phase 2: Document RAG with Chroma
**Goal**: Add smart document knowledge with proper vector search

### Tasks:
1. **Install Chroma** as embedded vector database
2. **Simple file upload** in agent dashboard (just .txt files initially)
3. **Document chunking** that respects sentences
4. **Chroma collection** for document storage with embeddings
5. **Semantic retrieval** with configurable k (start with k=10)
6. **Enhance OpenRouter prompts** with relevant document context
7. **Flowise still works exactly as before** (without RAG)

### Technical Details:
- Add Chroma dependency to Node.js backend
- Create Chroma collection for documents with metadata
- Character-based chunking with sentence boundaries (configurable size)
- Use Chroma's built-in embedding models or configure external embeddings
- File upload endpoint: `POST /api/documents`
- Document management UI in agent dashboard
- Environment variables: `RAG_ENABLED=true`, `RAG_TOP_K=10`, `CHUNK_SIZE=1000`

### Success Criteria:
- Agents can upload .txt documents
- Documents are chunked and embedded automatically in Chroma
- Semantic search finds relevant document chunks
- OpenRouter responses include accurate document context
- System performance remains stable (< 3 seconds response time)
- Flowise continues working without RAG as fallback

---

## Phase 3: Enhanced UI Features
**Goal**: Add Lizdeika-specific features gradually

### Tasks:
1. **Autopilot toggle** in agent dashboard
2. **Document management UI** (list, delete, re-upload)
3. **System status indicators** (autopilot on/off, AI provider)
4. **Better conversation history** in widget
5. **Worker assignment** improvements

### Technical Details:
- Add autopilot mode that bypasses human approval
- Document CRUD operations in dashboard
- Real-time status updates via existing WebSocket
- Conversation persistence across widget sessions
- Round-robin agent assignment with timeout handling

### Success Criteria:
- Agents can enable/disable autopilot mode
- Document library is manageable through UI
- Citizens get immediate responses in autopilot
- Worker assignment is fair and efficient

---

## Phase 4: API and Integration
**Goal**: External connectivity and advanced features

### Tasks:
1. **Document ingestion API** for external systems
2. **API key authentication** system
3. **Webhook support** for status updates
4. **iframe embedding option** alongside current widget
5. **Advanced document formats** (.docx, .rtf)

### Technical Details:
- REST API: `POST /api/ingest` with API key auth
- JWT-based API authentication
- Webhook callbacks for conversation events
- iframe widget with postMessage communication
- Document parsing libraries for multiple formats

### Success Criteria:
- External systems can push documents via API
- Widget can be embedded like YouTube videos
- System integrates with city's existing tools
- All document formats are supported

---

## Migration Strategy

### Environment Variables Evolution:
```bash
# Phase 1
AI_PROVIDER=flowise|openrouter|both
OPENROUTER_API_KEY=xxx
OPENROUTER_MODEL=google/gemini-2.0-flash-exp

# Phase 2
ENABLE_RAG=true
MAX_DOCUMENT_SIZE=10MB

# Phase 3  
EMBEDDINGS_PROVIDER=mistral
RAG_TOP_K=10
CHUNK_SIZE=1000

# Phase 4
AUTOPILOT_ENABLED=false
WORKER_TIMEOUT=30

# Phase 5
API_KEYS=key1,key2,key3
WEBHOOK_URL=https://city.vilnius.lt/webhooks
```

### Rollback Plan:
Each phase can be rolled back by:
1. Setting environment variables to previous values
2. Restarting the service
3. Previous functionality is immediately restored

### Testing Strategy:
- **Phase 1**: A/B test AI providers with real conversations
- **Phase 2**: Upload test documents, verify context injection
- **Phase 3**: Compare semantic vs keyword search quality
- **Phase 4**: Test autopilot with non-critical conversations
- **Phase 5**: Integration tests with external systems

### Success Metrics:
- **Response quality**: Agent satisfaction scores
- **Response time**: < 3 seconds end-to-end
- **System reliability**: 99.9% uptime
- **User adoption**: Agents actively use new features

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1 | 1-2 weeks | OpenRouter API access |
| Phase 2 | 1 week | File upload UI |
| Phase 3 | 2-3 weeks | Embeddings integration |
| Phase 4 | 2 weeks | UI/UX improvements |
| Phase 5 | 2-3 weeks | External API requirements |

**Total**: 8-11 weeks for complete migration

---

## Risk Mitigation

### High Risks:
1. **AI provider downtime** → Multiple fallback providers
2. **Document processing failure** → Graceful degradation to no-RAG mode
3. **Performance degradation** → Caching and optimization at each phase
4. **User resistance** → Gradual rollout with training

### Medium Risks:
1. **Integration complexity** → Thorough testing environment
2. **Data migration** → Phase-by-phase validation
3. **Security concerns** → Security review at each phase

### Low Risks:
1. **UI changes** → Minimal changes, familiar patterns
2. **Configuration drift** → Environment variable documentation
3. **Deployment issues** → Rollback procedures tested

---

## Next Steps

1. **Review and approve** this migration plan
2. **Set up development environment** for Phase 1
3. **Create feature branches** for each phase
4. **Begin Phase 1 implementation** - Dual AI Backend Support
5. **Establish testing procedures** and success criteria

This migration ensures we never break existing functionality while systematically building toward the full Lizdeika vision.