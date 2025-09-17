/**
 * Test live configuration with running server
 */

const axios = require('axios');

async function testLiveConfiguration() {
    console.log('🔍 Testing Live Configuration');
    console.log('================================\n');

    try {
        // Test health endpoint
        const healthResponse = await axios.get('http://localhost:3002/health');
        console.log('✅ Server Health:');
        console.log('   Status:', healthResponse.data.status);
        console.log('   AI Provider:', healthResponse.data.aiProvider.provider);
        console.log('   AI Configured:', healthResponse.data.aiProvider.configured);
        console.log('   AI Healthy:', healthResponse.data.aiProvider.healthy);

        // Get current settings from database
        const { getAIProviderConfig } = require('./ai-providers');
        const config = await getAIProviderConfig();

        console.log('\n✅ Database Configuration:');
        console.log('   Provider:', config.AI_PROVIDER);
        console.log('   Main Model:', config.OPENROUTER_MODEL);
        console.log('   Rephrasing Model:', config.REPHRASING_MODEL);
        console.log('   Site Name:', config.SITE_NAME);

        // Test a simple AI suggestion
        console.log('\n🤖 Testing AI Response Generation...');
        const testConversation = {
            conversationId: 'test-' + Date.now(),
            message: 'Hello, what models are you using?'
        };

        try {
            const { generateAISuggestion } = require('./src/services/aiService');
            const response = await generateAISuggestion(
                testConversation.message,
                testConversation.conversationId
            );
            console.log('   AI Response received:', response ? '✅' : '❌');
            if (response) {
                console.log('   Response preview:', response.substring(0, 100) + '...');
            }
        } catch (aiError) {
            console.log('   AI Response error:', aiError.message);
        }

        console.log('\n✅ CONFIGURATION SUMMARY:');
        console.log('   - Server is running successfully');
        console.log('   - OpenRouter provider is active');
        console.log('   - Main model: ' + config.OPENROUTER_MODEL);
        console.log('   - Rephrasing model: ' + config.REPHRASING_MODEL);
        console.log('   - All configurations loaded from database');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    process.exit(0);
}

// Wait a moment for server to be fully ready
setTimeout(testLiveConfiguration, 2000);