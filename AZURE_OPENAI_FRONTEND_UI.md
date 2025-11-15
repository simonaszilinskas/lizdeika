# Azure OpenAI Frontend UI Configuration

## Current Status

**Azure OpenAI provider is NOT yet supported in the admin settings UI.**

The backend fully supports Azure OpenAI configuration via:
- Environment variables (`.env` file)
- Database storage (via `settingsService.js`)

However, the frontend settings page (`custom-widget/settings.html`) currently only provides UI controls for:
- ✅ Flowise provider
- ✅ OpenRouter provider
- ❌ Azure OpenAI provider (missing)

## Configuration Methods

### Option 1: Environment Variables (Current Workaround)

Add to your `.env` file:

```bash
AI_PROVIDER=azure
AZURE_OPENAI_DEPLOYMENT_URI=https://your-resource.cognitiveservices.azure.com/openai/deployments/your-deployment/chat/completions?api-version=2024-10-21
AZURE_OPENAI_API_KEY=your-azure-api-key
```

### Option 2: Direct Database Update (Advanced)

Use Prisma Studio or SQL to insert settings into the `system_settings` table:

```sql
INSERT INTO system_settings (category, key, value) VALUES
  ('ai_providers', 'ai_provider', 'azure'),
  ('ai_providers', 'azure_openai_deployment_uri', 'https://...'),
  ('ai_providers', 'azure_openai_api_key', 'your-key');
```

## Planned Frontend UI Support

To add Azure OpenAI to the admin settings UI, the following changes are needed:

### 1. Update `settings.html`

Add a third radio option and configuration panel:

```html
<!-- Add to AI Provider Selection -->
<div class="flex items-center space-x-2">
    <input type="radio" name="ai_provider" value="azure" id="provider-azure" class="text-indigo-600 focus:ring-indigo-500">
    <label for="provider-azure" class="text-sm text-gray-900">Azure OpenAI (EU regions only)</label>
</div>

<!-- Add Azure OpenAI Configuration Panel -->
<div id="azure-config" class="space-y-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
    <h4 class="font-medium text-gray-900">Azure OpenAI Configuration</h4>
    <p class="text-sm text-gray-600">For GDPR compliance, only EU regions are supported.</p>

    <div class="grid grid-cols-1 gap-4">
        <div>
            <label for="azure-deployment-uri" class="block text-sm font-medium text-gray-700 mb-1">Deployment URI</label>
            <input type="url" id="azure-deployment-uri" name="azure_openai_deployment_uri"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="https://resource.cognitiveservices.azure.com/openai/deployments/model/chat/completions?api-version=2024-10-21">
        </div>

        <div>
            <label for="azure-api-key" class="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <input type="password" id="azure-api-key" name="azure_openai_api_key"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter Azure OpenAI API key">
        </div>
    </div>

    <button type="button" id="test-azure" class="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors">
        Test Azure OpenAI Connection
    </button>
</div>
```

### 2. Update `ContextEngineeringModule.js`

Add methods to handle Azure OpenAI configuration:

```javascript
initializeAzureListeners() {
    const testButton = document.getElementById('test-azure');
    const azureRadio = document.getElementById('provider-azure');
    const azureConfig = document.getElementById('azure-config');

    // Toggle visibility
    azureRadio?.addEventListener('change', () => {
        azureConfig.style.display = azureRadio.checked ? 'block' : 'none';
    });

    // Test connection
    testButton?.addEventListener('click', () => this.testAzureConnection());
}

async testAzureConnection() {
    const uri = document.getElementById('azure-deployment-uri').value;
    const apiKey = document.getElementById('azure-api-key').value;

    // Validate EU region
    const euRegions = ['westeurope', 'northeurope', 'swedencentral', 'francecentral',
                       'norwayeast', 'switzerlandnorth', 'germanywestcentral', 'uksouth', 'ukwest'];
    const isEU = euRegions.some(region => uri.toLowerCase().includes(region));

    if (!isEU) {
        this.showNotification('Error: Azure OpenAI resource must be in an EU region for GDPR compliance', 'error');
        return;
    }

    // Test API call
    const response = await this.apiManager.testAzureProvider({ uri, apiKey });
    this.showNotification(response.success ? 'Azure OpenAI connection successful!' : 'Connection failed',
                         response.success ? 'success' : 'error');
}
```

### 3. Add Backend Endpoint

Add to `custom-widget/backend/src/routes/settingsRoutes.js`:

```javascript
router.post('/test-azure', authenticateToken, requireAdmin, async (req, res) => {
    const { uri, apiKey } = req.body;

    try {
        const { AzureOpenAIProvider } = require('../ai-providers');
        const provider = new AzureOpenAIProvider({ deploymentUri: uri, apiKey });
        const isHealthy = await provider.healthCheck();

        res.json({ success: isHealthy, message: isHealthy ? 'Connection successful' : 'Health check failed' });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});
```

## Follow-up Task

Create GitHub issue to track frontend UI implementation for Azure OpenAI provider configuration.

## Recommended Priority

**Medium** - Environment variable configuration is sufficient for most deployments. Frontend UI is a nice-to-have for convenience but not blocking.
