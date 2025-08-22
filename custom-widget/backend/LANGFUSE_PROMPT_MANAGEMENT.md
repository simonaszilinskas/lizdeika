# 🎨 Langfuse Prompt Management Integration

## Overview

This document describes the Langfuse Prompt Management integration for the Vilnius Assistant, enabling non-technical prompt editing via the Langfuse UI and comprehensive prompt performance evaluation.

## ✨ Features

### 🎯 **Non-technical Prompt Management**
- Edit prompts through Langfuse web interface without code changes
- Version control with rollback capabilities
- A/B testing different prompt variations
- Performance tracking by prompt version

### 📊 **Analytics & Optimization** 
- Track which prompt versions perform better
- See prompt effectiveness across conversations
- Link prompts to traces for detailed analysis
- Automatic fallback to hardcoded prompts

### 🔧 **Optional Integration**
- Works with or without Langfuse credentials
- Graceful fallback to hardcoded prompts
- Zero impact on core functionality
- Performance-optimized with caching

## 🚀 Quick Start

### 1. Initialize Prompts in Langfuse

```bash
# Create all prompts in Langfuse for management
curl -X POST "http://localhost:3002/api/prompts/initialize"
```

This creates three managed prompts in your Langfuse dashboard:
- **vilnius-rag-system** - Main system prompt for RAG assistant  
- **vilnius-query-rephrase** - Query enhancement for better retrieval
- **vilnius-context-format** - Context formatting template

### 2. Edit Prompts in Langfuse UI

1. Visit [Langfuse Dashboard](https://cloud.langfuse.com)
2. Navigate to "Prompts" section
3. Edit any of the three Vilnius prompts
4. Promote changes to "production" label
5. Changes take effect immediately (with 5min cache)

### 3. Monitor Performance

- View prompt performance in Langfuse "Analytics"
- Compare different prompt versions
- Track improvements over time

## 🏗️ Architecture

### Managed Prompts

| Prompt Name | Purpose | Fallback |
|-------------|---------|----------|
| `vilnius-rag-system` | Main system instructions for Lithuanian city assistant | SYSTEM_PROMPT_TEMPLATE |
| `vilnius-query-rephrase` | Query enhancement for document retrieval | REPHRASE_PROMPT_TEMPLATE |  
| `vilnius-context-format` | Context formatting for RAG responses | CONTEXT_TEMPLATE |

### Prompt Manager Flow

```javascript
// 1. Try to fetch from Langfuse
const prompt = await promptManager.getPrompt('vilnius-rag-system', fallback);

// 2. If Langfuse unavailable, use fallback
// 3. Cache results for performance  
// 4. Link to traces for analytics
```

### Integration Points

- **VilniusRAGChain**: Uses managed system prompt
- **QueryRephraseChain**: Uses managed rephrasing prompt
- **Context Formatting**: Uses managed formatting template

## 🛠️ API Endpoints

### GET /api/prompts/health
Check prompt management system status

```bash
curl "http://localhost:3002/api/prompts/health"
```

**Response:**
```json
{
  "success": true,
  "health": {
    "enabled": true,
    "cacheSize": 0,
    "langfuseConnected": true,
    "prompts": {
      "system": "vilnius-rag-system",
      "rephrase": "vilnius-query-rephrase", 
      "context": "vilnius-context-format"
    }
  }
}
```

### POST /api/prompts/initialize
Initialize all prompts in Langfuse

```bash
curl -X POST "http://localhost:3002/api/prompts/initialize"
```

**Response:**
```json
{
  "success": true,
  "message": "Prompts initialized in Langfuse",
  "results": [
    {"name": "vilnius-rag-system", "success": true},
    {"name": "vilnius-query-rephrase", "success": true},
    {"name": "vilnius-context-format", "success": true}
  ]
}
```

## 💻 Developer Usage

### Using Managed Prompts

```javascript
const { getSystemPromptManaged } = require('./services/chains/VilniusPrompts');

// Get managed system prompt with fallback
const prompt = await getSystemPromptManaged({
  language: 'lithuanian'
});

// Compile with variables
const compiled = prompt.compile({
  context: documentContext,
  question: userQuestion
});

// Link to trace for performance tracking
await promptManager.linkPromptToTrace(prompt.managed, traceId);
```

### Fallback Behavior

```javascript
// If Langfuse unavailable:
// ✅ Uses hardcoded SYSTEM_PROMPT_TEMPLATE
// ✅ No performance impact
// ✅ Logs fallback usage
// ✅ System continues normally
```

## 🎯 Use Cases

### **Development Workflow**
1. **Initial Setup**: Use hardcoded prompts for development
2. **Production**: Initialize prompts in Langfuse
3. **Optimization**: Edit prompts via UI based on analytics
4. **A/B Testing**: Test different versions with labels

### **Non-technical Team Members**
- **Content Managers**: Update assistant personality and tone
- **Domain Experts**: Improve Lithuanian language accuracy  
- **Customer Success**: Refine responses based on feedback
- **Admins**: Quick fixes without code deployment

### **Performance Optimization**
- Track prompt effectiveness over time
- Identify which versions generate better responses
- Optimize based on user satisfaction metrics
- Roll back problematic changes instantly

## ⚙️ Configuration

### Environment Variables

```bash
# Required for Langfuse Prompt Management
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com

# Optional
LANGFUSE_DEBUG=true
```

### Caching Settings

- **Cache Duration**: 5 minutes (configurable)
- **Cache Strategy**: In-memory with automatic expiration
- **Cache Invalidation**: Manual via `promptManager.clearCache()`

## 🔍 Monitoring

### Performance Tracking

Each managed prompt automatically tracks:
- **Usage frequency** - How often each prompt is used
- **Response quality** - Linked to conversation outcomes
- **Version performance** - Compare different prompt versions
- **Error rates** - Track prompt-related failures

### Analytics Dashboard

In Langfuse, you'll see:
- **Prompt Usage**: Charts showing prompt usage over time
- **Version Comparison**: Performance metrics by version
- **Trace Linking**: See which prompts led to which responses
- **Cost Analysis**: Token usage per prompt version

## 🚨 Troubleshooting

### Common Issues

1. **Prompts not updating**
   ```bash
   # Clear cache and retry
   curl -X GET "http://localhost:3002/api/prompts/health"
   # Cache will auto-refresh in 5 minutes
   ```

2. **Langfuse connection issues**
   ```bash
   # Check credentials
   echo $LANGFUSE_PUBLIC_KEY
   echo $LANGFUSE_SECRET_KEY
   
   # Verify connectivity
   curl -X GET "http://localhost:3002/api/prompts/health"
   ```

3. **Fallback behavior**
   ```bash
   # System automatically falls back to hardcoded prompts
   # Check logs for fallback messages
   ```

### Debug Mode

```bash
LANGFUSE_DEBUG=true npm start
```

## 🎨 Best Practices

### **Prompt Versioning**
- Use semantic versioning in commit messages
- Test changes in `staging` label before `production`
- Document significant prompt changes

### **Performance Optimization** 
- Monitor response quality after prompt changes
- A/B test major modifications
- Keep fallback prompts updated

### **Team Collaboration**
- Use descriptive commit messages in Langfuse
- Coordinate changes across team members
- Set up notifications for prompt updates

## 🔗 Integration Examples

### **Custom Chain Integration**

```javascript
// Custom chain using managed prompts
class CustomVilniusChain extends BaseChain {
  async _call(values) {
    // Get managed prompt with performance tracking
    const prompt = await getSystemPromptManaged();
    
    // Use in chain
    const response = await this.llm.call(
      prompt.compile(values),
      { metadata: prompt.metadata }
    );
    
    return { response };
  }
}
```

### **Direct LLM Integration**

```javascript
// Direct OpenRouter integration with managed prompts
const prompt = await getSystemPromptManaged();
const response = await openai.completions.create({
  model: "gpt-4",
  prompt: prompt.compile({ context, question }),
  langfusePrompt: prompt.managed.langfusePrompt
});
```

---

**Integration Status**: ✅ **ACTIVE** - Langfuse Prompt Management is fully integrated and operational.

**Next Steps**: Edit prompts in your Langfuse dashboard to see real-time changes in the assistant behavior!