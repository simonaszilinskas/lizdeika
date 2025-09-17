/**
 * Test API save with the new rephrasing_model field
 */

const axios = require('axios');

async function testAPISave() {
    console.log('🔍 Testing API Save with Rephrasing Model');
    console.log('==========================================\n');

    try {
        // First login to get token
        const loginResponse = await axios.post('http://localhost:3002/api/auth/login', {
            email: 'admin@vilnius.lt',
            password: 'admin123'
        });

        const token = loginResponse.data.token;
        console.log('✅ Login successful');

        // Test saving the AI provider settings
        const settingsData = {
            ai_provider: 'openrouter',
            openrouter_api_key: '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',
            openrouter_model: 'anthropic/claude-sonnet-4',
            rephrasing_model: 'openai/gpt-5-nano',
            site_url: 'http://localhost:3002',
            site_name: 'Vilniaus chatbot'
        };

        console.log('🔧 Testing save with models:');
        console.log('   Main Model:', settingsData.openrouter_model);
        console.log('   Rephrasing Model:', settingsData.rephrasing_model);

        const saveResponse = await axios.post('http://localhost:3002/api/settings/ai_providers', settingsData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (saveResponse.data.success) {
            console.log('✅ Configuration saved successfully!');

            // Verify the settings were saved
            const getResponse = await axios.get('http://localhost:3002/api/settings/ai_providers', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log('\n✅ Verification - Settings in database:');
            console.log('   Main Model:', getResponse.data.data.openrouter_model?.value);
            console.log('   Rephrasing Model:', getResponse.data.data.rephrasing_model?.value);

        } else {
            console.log('❌ Save failed:', saveResponse.data.message);
        }

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }

    process.exit(0);
}

// Wait for server to be ready
setTimeout(testAPISave, 2000);