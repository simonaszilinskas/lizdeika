# Environment Variables Reference

## 📋 Overview

Complete reference for all environment variables used in the Vilnius Assistant system. All variables should be set in your `.env` file in the `custom-widget/backend/` directory.

## 🔧 Required Variables

### Database Configuration
```bash
# PostgreSQL database connection
DATABASE_URL="postgresql://username:password@localhost:5432/vilnius_support"
```
- **Purpose**: PostgreSQL database connection string for Prisma ORM
- **Format**: Standard PostgreSQL connection URL
- **Required**: Yes
- **Default**: None
- **Example**: `postgresql://postgres:password@localhost:5432/vilnius_support`

### AI Provider Configuration
```bash
# OpenRouter AI Provider
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
OPENROUTER_MODEL=google/gemini-2.5-flash
```
- **OPENROUTER_API_KEY**: Your OpenRouter API key for AI completions
  - **Required**: Yes  
  - **Format**: `sk-or-v1-` followed by your key
  - **Where to get**: [OpenRouter Dashboard](https://openrouter.ai/)
  
- **OPENROUTER_MODEL**: AI model to use for conversations
  - **Required**: Yes
  - **Default**: `google/gemini-2.5-flash`
  - **Options**: Any model available on OpenRouter
  - **Recommended**: `google/gemini-2.5-flash` (fast, cost-effective)

### Vector Database Configuration (ChromaDB)
```bash
# Chroma Cloud Configuration
CHROMA_URL=https://api.trychroma.com
CHROMA_TENANT=your-tenant-id
CHROMA_DATABASE=your-database-name  
CHROMA_AUTH_TOKEN=your-auth-token
```
- **CHROMA_URL**: ChromaDB API endpoint
  - **Required**: Yes
  - **Default**: `https://api.trychroma.com`
  - **For local**: Use `http://localhost:8000`
  
- **CHROMA_TENANT**: Your ChromaDB tenant identifier
  - **Required**: Yes (for Chroma Cloud)
  - **Format**: UUID or custom tenant ID
  
- **CHROMA_DATABASE**: Database name within your tenant
  - **Required**: Yes
  - **Format**: String identifier
  
- **CHROMA_AUTH_TOKEN**: Authentication token for ChromaDB
  - **Required**: Yes (for Chroma Cloud)
  - **Format**: Bearer token string

## ⚙️ Optional Configuration

### Application Settings
```bash
# Environment and Server
NODE_ENV=development
PORT=3002
```
- **NODE_ENV**: Application environment mode
  - **Options**: `development`, `production`, `test`
  - **Default**: `development`
  - **Impact**: Enables/disables debugging, logging levels, error details
  
- **PORT**: Server port for backend API
  - **Default**: `3002`
  - **Range**: Any available port (typically 3000-9999)

### RAG (Retrieval Augmented Generation) Settings
```bash
# RAG Configuration
RAG_K=3
ENABLE_QUERY_REPHRASING=true
RAG_SHOW_SOURCES=true
```
- **RAG_K**: Number of documents to retrieve from vector database
  - **Default**: `3`
  - **Range**: 1-10 (higher values may impact performance)
  - **Impact**: More documents = better context but slower responses
  
- **ENABLE_QUERY_REPHRASING**: Whether to rephrase user queries for better retrieval
  - **Default**: `true`
  - **Options**: `true`, `false`
  - **Impact**: Improves search accuracy but adds latency
  
- **RAG_SHOW_SOURCES**: Include source document information in responses
  - **Default**: `true`
  - **Options**: `true`, `false`
  - **Impact**: Helps with transparency and debugging

### Langfuse Observability (Optional)
```bash
# LLM Observability and Tracing
LANGFUSE_PUBLIC_KEY=pk_your_public_key
LANGFUSE_SECRET_KEY=sk_your_secret_key
LANGFUSE_BASE_URL=https://cloud.langfuse.com
LANGFUSE_DEBUG=false
```
- **LANGFUSE_PUBLIC_KEY**: Public key for Langfuse observability platform
  - **Required**: No (optional feature)
  - **Format**: `pk_` followed by key
  
- **LANGFUSE_SECRET_KEY**: Secret key for Langfuse
  - **Required**: No (optional feature)
  - **Format**: `sk_` followed by key
  
- **LANGFUSE_BASE_URL**: Langfuse instance URL
  - **Default**: `https://cloud.langfuse.com`
  - **For self-hosted**: Your Langfuse instance URL
  
- **LANGFUSE_DEBUG**: Enable debug logging for Langfuse
  - **Default**: `false`
  - **Options**: `true`, `false`

## 📝 Example .env File

```bash
# Database
DATABASE_URL="postgresql://postgres:mypassword@localhost:5432/vilnius_support"

# AI Provider  
OPENROUTER_API_KEY=sk-or-v1-abc123def456ghi789
OPENROUTER_MODEL=google/gemini-2.5-flash

# Vector Database
CHROMA_URL=https://api.trychroma.com
CHROMA_TENANT=12345678-1234-1234-1234-123456789012
CHROMA_DATABASE=vilnius-knowledge-base
CHROMA_AUTH_TOKEN=chroma_auth_token_here

# Application
NODE_ENV=development
PORT=3002

# RAG Settings
RAG_K=3
ENABLE_QUERY_REPHRASING=true
RAG_SHOW_SOURCES=true

# Observability (Optional)
LANGFUSE_PUBLIC_KEY=pk_your_key_here
LANGFUSE_SECRET_KEY=sk_your_key_here
LANGFUSE_BASE_URL=https://cloud.langfuse.com
LANGFUSE_DEBUG=false
```

## 🔍 Environment Variable Validation

The system validates required environment variables on startup. Missing required variables will cause the application to fail with clear error messages.

### Validation Checks:
1. **Database Connection**: Tests PostgreSQL connection on startup
2. **AI Provider**: Validates OpenRouter API key format and connectivity  
3. **Vector Database**: Confirms ChromaDB connection and authentication
4. **Model Availability**: Verifies selected AI model is available

## 🚨 Security Best Practices

### Protect Sensitive Variables
- Never commit `.env` files to version control
- Use different keys for development/production
- Rotate API keys regularly
- Restrict database access by IP when possible

### Required .gitignore Entries
```bash
# Environment files
.env
.env.local  
.env.production
.env.development
```

## 📊 Environment-Specific Configurations

### Development
- `NODE_ENV=development`
- Local PostgreSQL database
- Debug logging enabled
- Relaxed CORS settings

### Production  
- `NODE_ENV=production`
- Managed database service (AWS RDS, etc.)
- Error logging only
- Strict security headers
- Rate limiting enabled

### Testing
- `NODE_ENV=test`
- Test database (separate from development)
- Mock external services
- Reduced timeouts for faster tests

## 🔗 Related Documentation

- [Developer Guide](./DEVELOPER_GUIDE.md) - Complete setup instructions
- [API Guide](./API_GUIDE.md) - API authentication and endpoints
- [Langfuse Integration](./backend/LANGFUSE_INTEGRATION.md) - Observability setup

---

*Last updated: September 2025*