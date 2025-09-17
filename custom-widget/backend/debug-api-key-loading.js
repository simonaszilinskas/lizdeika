const SettingsService = require('./src/services/settingsService');

async function debugAPIKeyLoading() {
    console.log('🔍 Debugging API Key Loading');
    console.log('==============================');

    try {
        const settingsService = new SettingsService();

        // Wait a moment for initialization
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('\n1. Testing getSettingsByCategory with includePrivate=true:');
        const aiSettings = await settingsService.getSettingsByCategory('ai_providers', true);
        console.log('AI Settings:', JSON.stringify(aiSettings, null, 2));

        console.log('\n2. Testing getAIProviderConfig:');
        const config = await settingsService.getAIProviderConfig();
        console.log('Config object:');
        console.log('  AI_PROVIDER:', config.AI_PROVIDER);
        console.log('  OPENROUTER_API_KEY:', config.OPENROUTER_API_KEY ? '[PRESENT]' : '[MISSING]');
        console.log('  OPENROUTER_MODEL:', config.OPENROUTER_MODEL);
        console.log('  SITE_NAME:', config.SITE_NAME);
        console.log('  SITE_URL:', config.SITE_URL);

        console.log('\n3. Testing direct database query:');
        const directSetting = await settingsService.getSetting('openrouter_api_key', 'ai_providers');
        console.log('Direct setting value:', directSetting ? '[PRESENT]' : '[MISSING]');

    } catch (error) {
        console.error('❌ Error:', error);
    }

    process.exit(0);
}

debugAPIKeyLoading();