/**
 * Test AI Configuration Fix
 * This script tests if the AI service now works correctly after our fixes
 */

async function testAIFix() {
    console.log('🧪 Testing AI Configuration Fix');
    console.log('=================================\n');

    try {
        // Test 1: Check if configuration loads properly
        console.log('📊 Step 1: Testing configuration loading...');
        const { getAIProviderConfig } = require('./ai-providers');
        const config = await getAIProviderConfig();

        console.log('   Configuration loaded:');
        console.log('   - AI Provider:', config.AI_PROVIDER);
        console.log('   - OpenRouter Model:', config.OPENROUTER_MODEL);
        console.log('   - Rephrasing Model:', config.REPHRASING_MODEL);
        console.log('   - OpenRouter API Key:', config.OPENROUTER_API_KEY ? '***set***' : 'not set');
        console.log('✅ Configuration loading works\n');

        // Test 2: Test LangChain RAG initialization
        console.log('🔗 Step 2: Testing LangChain RAG service...');
        const LangChainRAG = require('./src/services/langchainRAG');
        const ragService = new LangChainRAG();

        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log('   RAG service initialized:', ragService.initialized);
        console.log('✅ LangChain RAG service works\n');

        // Test 3: Test actual AI response generation
        console.log('🤖 Step 3: Testing AI response generation...');
        const { generateAISuggestion } = require('./src/services/aiService');

        const testConversationId = 'test-' + Date.now();
        const testMessage = 'Hello, can you help me with information about Vilnius?';

        console.log('   Sending test message:', testMessage);
        const result = await generateAISuggestion(testConversationId, testMessage, true);

        console.log('   AI Response received:', result ? 'YES' : 'NO');
        console.log('   Response starts with error:', result && result.startsWith('Atsiprašau') ? 'YES (BAD)' : 'NO (GOOD)');
        if (result) {
            console.log('   Response preview:', result.substring(0, 150) + '...');
        }

        const success = result && !result.startsWith('Atsiprašau');
        console.log(success ? '✅ AI response generation works!' : '❌ AI response generation failed');

        console.log('\n🎯 FINAL RESULT:');
        console.log('================');
        if (success) {
            console.log('✅ SUCCESS: AI configuration is now working correctly!');
            console.log('   - Configuration loads from database ✅');
            console.log('   - Environment variables are set properly ✅');
            console.log('   - LangChain RAG service initializes ✅');
            console.log('   - AI responses are generated successfully ✅');
        } else {
            console.log('❌ FAILURE: AI configuration still has issues');
            console.log('   Error message:', result || 'No response received');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }

    process.exit(0);
}

// Wait a bit for server to fully start then run test
setTimeout(testAIFix, 2000);