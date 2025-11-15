# Azure OpenAI Setup Guide

## Your Configuration

Based on your Azure OpenAI endpoint, here's your configuration:

```bash
AI_PROVIDER=azure
AZURE_OPENAI_RESOURCE_NAME=simon-mi0dgd8i-swedencentral.cognitiveservices.azure.com
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-5.1-chat
AZURE_OPENAI_API_KEY=your-azure-api-key-here
AZURE_OPENAI_API_VERSION=2025-01-01-preview
```

## Setup Method 1: Environment Variables (.env file)

1. **Create or edit `.env` file**:
```bash
cd custom-widget/backend
cp .env.example .env
```

2. **Add Azure OpenAI configuration** to `.env`:
```bash
# AI Provider
AI_PROVIDER=azure

# Azure OpenAI Configuration
AZURE_OPENAI_RESOURCE_NAME=simon-mi0dgd8i-swedencentral.cognitiveservices.azure.com
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-5.1-chat
AZURE_OPENAI_API_KEY=your-azure-api-key-here
AZURE_OPENAI_API_VERSION=2025-01-01-preview
```

3. **Restart the application**:
```bash
# Docker
docker-compose restart backend

# Or direct Node.js
npm run dev
```

## Setup Method 2: Admin UI (Recommended for Production)

1. **Navigate to Settings**:
   - Go to: `http://localhost:3002/settings.html`
   - Login as admin: `admin@lizdeika.lt` / `admin123`

2. **Configure AI Provider**:
   - Click on "Context Engineering" tab
   - AI Provider: Select **"Azure OpenAI"**
   - Resource Name: `simon-mi0dgd8i-swedencentral.cognitiveservices.azure.com`
   - Deployment Name: `gpt-5.1-chat`
   - API Key: `[paste your key]`
   - API Version: `2025-01-01-preview`

3. **Click Save** - Configuration is stored encrypted in database

## Testing the Integration

### Quick Test (curl)

```bash
curl -X POST "https://simon-mi0dgd8i-swedencentral.cognitiveservices.azure.com/openai/deployments/gpt-5.1-chat/chat/completions?api-version=2025-01-01-preview" \
  -H "api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello, can you respond briefly?"}
    ]
  }'
```

Expected response:
```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help you today?"
    }
  }]
}
```

### Test in Lizdeika Application

1. **Start the application**:
```bash
docker-compose up --build
```

2. **Open agent dashboard**:
   - Go to: `http://localhost:3002/agent-dashboard.html`
   - Login with agent credentials

3. **Create a test conversation** and click "Generate AI Suggestion"

4. **Check logs** for Azure OpenAI activity:
```bash
docker-compose logs -f backend | grep -i "azure"
```

### Test Script (Node.js)

From the project root, run:
```bash
node test-azure-openai.js
```

This will test:
- ✅ Provider initialization
- ✅ EU region validation (Sweden Central)
- ✅ Endpoint construction
- ✅ API authentication
- ✅ Simple conversation
- ✅ Multi-turn conversation

## Configuration Details

### Endpoint Format Support

The implementation supports both Azure endpoint formats:

1. **New format** (default):
   - Resource name: `simon-mi0dgd8i-swedencentral`
   - Endpoint: `https://simon-mi0dgd8i-swedencentral.openai.azure.com/...`

2. **Legacy format** (your case):
   - Resource name: `simon-mi0dgd8i-swedencentral.cognitiveservices.azure.com`
   - Endpoint: `https://simon-mi0dgd8i-swedencentral.cognitiveservices.azure.com/...`

If the resource name contains a dot (`.`), it's treated as a full domain name.

### EU Region Validation

Your resource is in **Sweden Central** which is automatically validated as an EU region ✅

Supported EU regions:
- West Europe
- North Europe
- **Sweden Central** (your region)
- France Central
- Norway East
- Switzerland North
- Germany West Central
- UK South
- UK West

### API Version

You're using `2025-01-01-preview` which is a preview version:

- **Latest GA**: `2024-10-21` (stable)
- **Latest Preview**: `2025-01-01-preview` (newer features)

Note: The implementation does not use `max_tokens` parameter as Azure OpenAI handles token limits automatically.

## Troubleshooting

### Issue: 401 Unauthorized
**Cause**: Invalid API key
**Solution**: Double-check the API key in Azure Portal → Keys and Endpoint

### Issue: 404 Not Found
**Cause**: Deployment name doesn't exist
**Solution**: Verify deployment name in Azure Portal → Deployments (should be `gpt-5-chat`)

### Issue: Region validation fails
**Cause**: Resource not in EU region
**Solution**: Create a new Azure OpenAI resource in an EU region

### Issue: API version not supported
**Cause**: Using an outdated or invalid API version
**Solution**: Try `2024-10-21` (latest GA) or check Azure docs for supported versions

## Security Best Practices

✅ **DO**:
- Use admin UI for production (stores encrypted in database)
- Add `.env` to `.gitignore` (already done)
- Rotate API keys periodically
- Use HTTPS for all communications

❌ **DON'T**:
- Commit `.env` file to git
- Share API keys publicly
- Use same credentials for dev and production

## Next Steps

1. ✅ Configuration added
2. ⏳ Start application with Azure OpenAI
3. ⏳ Test AI suggestions in agent dashboard
4. ⏳ Monitor logs for any errors
5. ⏳ Compare response quality with OpenRouter/Flowise

## Support

If you encounter issues:
1. Check backend logs: `docker-compose logs -f backend`
2. Verify endpoint with curl test above
3. Check Azure Portal for quota limits
4. Review CLAUDE.md for detailed architecture docs
