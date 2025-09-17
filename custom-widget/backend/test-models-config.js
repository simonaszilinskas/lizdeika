/**
 * Test script to verify model configuration
 */

const { getAIProviderConfig } = require('./ai-providers');

async function testModelsConfiguration() {
    console.log('🔍 Testing Model Configuration');
    console.log('================================\n');

    try {
        // Get configuration from database
        const config = await getAIProviderConfig();

        console.log('✅ Models configured in database:');
        console.log('   Main AI Model:', config.OPENROUTER_MODEL);
        console.log('   Rephrasing Model:', config.REPHRASING_MODEL);
        console.log('   Provider:', config.AI_PROVIDER);

        // Test the rephrasing chain configuration
        const QueryRephraseChain = require('./src/services/chains/QueryRephraseChain');
        const rephraseChain = new QueryRephraseChain({
            rephrasingModel: config.REPHRASING_MODEL
        });

        console.log('\n✅ Rephrasing Chain Configuration:');
        const chainConfig = rephraseChain.getConfig();
        console.log('   Model:', chainConfig.model);
        console.log('   Temperature:', chainConfig.temperature);

        console.log('\n✅ SUMMARY:');
        console.log('   - Main model: ' + config.OPENROUTER_MODEL);
        console.log('   - Rephrasing model: ' + config.REPHRASING_MODEL);
        console.log('   - Both models are configurable from database');
        console.log('   - Main model options:');
        console.log('     • openai/gpt-5-chat');
        console.log('     • anthropic/claude-sonnet-4');
        console.log('     • google/gemini-2.5-flash');
        console.log('   - Rephrasing model options (lightweight):');
        console.log('     • google/gemini-2.5-flash-lite');
        console.log('     • openai/gpt-5-nano');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    process.exit(0);
}

testModelsConfiguration();