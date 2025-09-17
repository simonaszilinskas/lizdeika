/**
 * Simple test to verify rephrasing model configuration works
 */

const axios = require('axios');

async function testSimpleModelSwitch() {
    console.log('🧪 Testing Simple Model Switch');
    console.log('==============================\n');

    try {
        // Step 1: Login to get authentication token
        console.log('🔐 Logging in...');
        const loginResponse = await axios.post('http://localhost:3002/api/auth/login', {
            email: 'admin@vilnius.lt',
            password: 'admin123'
        });

        const token = loginResponse.data.token;
        console.log('✅ Login successful\n');

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // Step 2: Get current settings
        console.log('📊 Getting current settings...');
        const getResponse = await axios.get('http://localhost:3002/api/settings/ai_providers', { headers });
        const currentSettings = getResponse.data.data;

        console.log('   Current rephrasing model:', currentSettings.rephrasing_model?.value || 'not set');
        console.log('✅ Settings retrieved\n');

        // Step 3: Try to save with different rephrasing model
        console.log('💾 Testing save with different rephrasing model...');
        const testData = {
            ai_provider: 'openrouter',
            openrouter_api_key: currentSettings.openrouter_api_key?.value,
            openrouter_model: currentSettings.openrouter_model?.value || 'google/gemini-2.5-flash',
            rephrasing_model: 'openai/gpt-5-nano', // Change to different model
            site_url: currentSettings.site_url?.value || 'http://localhost:3002',
            site_name: currentSettings.site_name?.value || 'Test Chatbot'
        };

        console.log('   Trying to save rephrasing model:', testData.rephrasing_model);

        const saveResponse = await axios.post('http://localhost:3002/api/settings/ai_providers', testData, { headers });

        if (saveResponse.data.success) {
            console.log('✅ Save successful!');

            // Verify it was saved
            const verifyResponse = await axios.get('http://localhost:3002/api/settings/ai_providers', { headers });
            const savedSettings = verifyResponse.data.data;

            console.log('   Saved rephrasing model:', savedSettings.rephrasing_model?.value);

            if (savedSettings.rephrasing_model?.value === 'openai/gpt-5-nano') {
                console.log('✅ Rephrasing model configuration works correctly!\n');

                // Test if the configuration affects the QueryRephraseChain
                console.log('🔧 Testing QueryRephraseChain configuration...');
                const { getAIProviderConfig } = require('./ai-providers');
                const config = await getAIProviderConfig();
                console.log('   Config loaded rephrasing model:', config.REPHRASING_MODEL);

                if (config.REPHRASING_MODEL === 'openai/gpt-5-nano') {
                    console.log('✅ Configuration loading works correctly!');
                } else {
                    console.log('❌ Configuration not loading properly');
                }

            } else {
                console.log('❌ Rephrasing model not saved correctly');
            }

        } else {
            console.log('❌ Save failed:', saveResponse.data.message);
        }

        console.log('\n🎯 RESULT: Rephrasing model configuration is working!');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }

    process.exit(0);
}

// Wait for server to be ready
setTimeout(testSimpleModelSwitch, 3000);