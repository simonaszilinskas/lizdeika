# LangChain Refactor Implementation Plan

## 🎯 **Objective**
Refactor the existing LangChain implementation to use proper LangChain patterns and chains while maintaining 100% functional compatibility with the current system.

## 📋 **Current State Analysis**

### What Works Currently:
- ✅ ChromaDB vector storage with Mistral embeddings
- ✅ Query rephrasing using separate LLM model
- ✅ Context retrieval and formatting
- ✅ Bilingual support (Lithuanian/English)
- ✅ Comprehensive debug information capture
- ✅ Conversation history parsing
- ✅ Source attribution and metadata handling
- ✅ Error handling and fallbacks

### What's Wrong with Current Implementation:
- ❌ Manual message construction instead of LangChain chains
- ❌ No use of LangChain's memory management
- ❌ Manual conversation history parsing
- ❌ No proper retriever abstraction
- ❌ Missing document loader patterns
- ❌ Inefficient dual LLM calls
- ❌ Hardcoded prompt templates
- ❌ No chain composition

## 🏗️ **Refactor Strategy**

### Phase 1: Core Chain Implementation
1. **Create Proper Retriever**
   - Implement custom ChromaRetriever extending BaseRetriever
   - Maintain compatibility with existing knowledgeService
   - Preserve Mistral embedding functionality

2. **Implement Conversation Memory**
   - Replace manual history parsing with BufferMemory
   - Maintain conversation context format
   - Preserve debug information capture

3. **Create Prompt Templates**
   - Convert hardcoded prompts to PromptTemplate instances
   - Maintain Lithuanian system instructions
   - Preserve query rephrasing logic

### Phase 2: Chain Composition
1. **Query Rephrase Chain**
   - Create dedicated chain for query rephrasing
   - Maintain conversation context awareness
   - Preserve conditional rephrasing logic

2. **Main RAG Chain**
   - Implement ConversationalRetrievalQAChain
   - Integrate custom retriever
   - Maintain source attribution

3. **Chain Orchestration**
   - Use LangGraph for step-by-step processing
   - Maintain debug information at each step
   - Preserve error handling

### Phase 3: Integration & Testing
1. **Backward Compatibility**
   - Maintain exact same API interface
   - Preserve all existing functionality
   - Keep debug information structure

2. **Performance Optimization**
   - Reduce to single LLM call where possible
   - Implement proper caching
   - Maintain response quality

## 📁 **File Changes Required**

### New Files:
- `src/services/chains/ChromaRetriever.js` - Custom retriever for ChromaDB
- `src/services/chains/VilniusPrompts.js` - Centralized prompt templates
- `src/services/chains/QueryRephraseChain.js` - Query rephrasing chain
- `src/services/chains/VilniusRAGChain.js` - Main RAG chain
- `src/services/chains/ChainOrchestrator.js` - LangGraph orchestration

### Modified Files:
- `src/services/langchainRAG.js` - Refactor to use proper chains
- `src/services/aiService.js` - Update to use new chain architecture
- `package.json` - Add required LangChain dependencies

### Dependencies to Add:
```json
{
  "@langchain/community": "^0.3.50", // Already present
  "langchain": "^0.3.0", // Add main LangChain package
  "langgraph": "^0.2.0" // Add LangGraph for orchestration
}
```

## 🔄 **Implementation Steps**

### Step 1: Create Custom ChromaRetriever
```javascript
class ChromaRetriever extends BaseRetriever {
  async _getRelevantDocuments(query) {
    // Integrate with existing knowledgeService
    // Maintain Mistral embedding functionality
    // Return proper Document objects
  }
}
```

### Step 2: Implement Conversation Memory
```javascript
class VilniusConversationMemory extends BufferMemory {
  // Parse existing conversation format
  // Maintain compatibility with current data structure
  // Preserve debug information
}
```

### Step 3: Create Prompt Templates
```javascript
const SYSTEM_PROMPT = new PromptTemplate({
  template: `UŽDUOTIS:
  Tu esi naudingas Vilniaus miesto savivaldybės...`,
  inputVariables: []
});

const REPHRASE_PROMPT = new PromptTemplate({
  template: `Užduotis: Perrašyk vartotojo klausimą...
  {chat_history}
  {question}`,
  inputVariables: ["chat_history", "question"]
});
```

### Step 4: Build Query Rephrase Chain
```javascript
class QueryRephraseChain extends LLMChain {
  constructor(llm) {
    super({
      llm,
      prompt: REPHRASE_PROMPT,
      outputKey: "rephrased_query"
    });
  }
}
```

### Step 5: Create Main RAG Chain
```javascript
class VilniusRAGChain extends ConversationalRetrievalQAChain {
  static fromLLM(llm, retriever, options) {
    // Custom implementation maintaining all features
    // Integrate query rephrasing
    // Preserve source attribution
  }
}
```

### Step 6: LangGraph Orchestration
```javascript
const workflow = new StateGraph({
  channels: {
    question: String,
    chat_history: Array,
    rephrased_query: String,
    context: Array,
    answer: String,
    debug_info: Object
  }
});

workflow.addNode("rephrase", rephraseQuery);
workflow.addNode("retrieve", retrieveContext);
workflow.addNode("generate", generateAnswer);
workflow.addEdge("rephrase", "retrieve");
workflow.addEdge("retrieve", "generate");
```

## ✅ **Success Criteria**

### Functional Compatibility:
1. ✅ Same API interface (`getAnswer(query, chatHistory, includeDebug)`)
2. ✅ Identical response quality and format
3. ✅ Same debug information structure
4. ✅ All existing error handling preserved
5. ✅ ChromaDB and Mistral embeddings working
6. ✅ Query rephrasing functionality maintained
7. ✅ Source attribution preserved
8. ✅ Lithuanian language support intact

### Performance Improvements:
1. 📈 Reduced LLM calls where possible
2. 📈 Better memory management
3. 📈 Improved caching
4. 📈 More efficient prompt handling

### Code Quality:
1. 🏗️ Proper LangChain patterns
2. 🏗️ Composable chain architecture
3. 🏗️ Better separation of concerns
4. 🏗️ Maintainable and extensible code

## 🧪 **Testing Strategy**

### Unit Tests:
- Test each chain component individually
- Verify backward compatibility
- Test error handling scenarios

### Integration Tests:
- End-to-end RAG pipeline testing
- ChromaDB integration verification
- Debug information validation

### Performance Tests:
- Response time comparison
- Memory usage analysis
- LLM call efficiency

## 📊 **Risk Mitigation**

### Low Risk Changes:
- Creating new chain classes
- Adding LangGraph orchestration
- Implementing custom retriever

### Medium Risk Changes:
- Modifying conversation memory handling
- Changing prompt template structure
- Updating API integration

### High Risk Changes:
- Replacing core langchainRAG.js logic
- Modifying aiService integration
- Changing debug information structure

### Mitigation Strategies:
1. **Feature Flags**: Allow switching between old and new implementations
2. **Comprehensive Testing**: Extensive test coverage before deployment
3. **Gradual Rollout**: Phase implementation with rollback capability
4. **Monitoring**: Track response quality and performance metrics

## 📅 **Implementation Timeline**

### Day 1: Foundation
- Create custom retriever
- Implement conversation memory
- Set up prompt templates

### Day 2: Chain Building
- Build query rephrase chain
- Create main RAG chain
- Implement orchestration

### Day 3: Integration
- Update aiService integration
- Preserve all existing functionality
- Add comprehensive testing

### Day 4: Testing & Validation
- Run full test suite
- Performance validation
- Debug information verification

## 🔄 **Rollback Plan**

If issues arise:
1. **Immediate**: Feature flag to old implementation
2. **Short-term**: Git revert to working state
3. **Long-term**: Analyze issues and iterate

## 📈 **Expected Benefits**

### Immediate:
- ✅ Proper LangChain usage
- ✅ Better code maintainability
- ✅ Reduced technical debt

### Long-term:
- 📈 Easier feature additions
- 📈 Better performance
- 📈 Improved debugging capabilities
- 📈 Community standard compliance

## 🎯 **Success Metrics**

1. **Functionality**: 100% backward compatibility
2. **Performance**: ≤10% response time increase (ideally improvement)
3. **Code Quality**: Proper LangChain patterns implemented
4. **Maintainability**: Reduced complexity and better separation of concerns

---

*This plan ensures we leverage LangChain's full potential while maintaining the sophisticated functionality that already works in the current system.*