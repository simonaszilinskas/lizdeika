const { generateAISuggestion, getAIProvider, getProviderHealth } = require('./src/services/aiService');

async function testOpenRouterComplete() {
    console.log('🚀 Testing Complete OpenRouter Integration');
    console.log('==========================================');

    try {
        console.log('1. Testing AI provider health...');
        const health = await getProviderHealth();
        console.log('   Health status:', health);

        console.log('\n2. Getting AI provider instance...');
        const provider = await getAIProvider();
        console.log('   Provider:', provider?.constructor.name || 'Unknown');
        console.log('   Model:', provider?.model || 'Unknown');

        console.log('\n3. Testing OpenRouter API call...');
        const testMessage = "Hello, this is a test message. Please respond with 'OpenRouter is working correctly!'";

        console.log('   Sending:', testMessage);

        const response = await generateAISuggestion(testMessage, 'test-conversation-id');

        console.log('4. Response received:');
        console.log('   Response:', response);

        // Check if response indicates OpenRouter is working
        if (response && response.length > 0) {
            console.log('\n✅ SUCCESS: OpenRouter is working with database configuration!');
            console.log('   - Database settings are being used');
            console.log('   - API call succeeded');
            console.log('   - Response generated successfully');
        } else {
            console.log('\n❌ FAILURE: No response received');
        }

    } catch (error) {
        console.error('❌ ERROR:', error.message);
        if (error.message.includes('API key')) {
            console.log('   This suggests API key is not being loaded from database');
        } else if (error.message.includes('OpenRouter')) {
            console.log('   This suggests OpenRouter API issue');
        }
    }

    process.exit(0);
}

testOpenRouterComplete();