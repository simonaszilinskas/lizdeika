#!/usr/bin/env node
/**
 * Test AI Configuration at Runtime
 * This tests what configuration is actually loaded when AI service initializes
 */

require('dotenv').config();

async function testAIConfigRuntime() {
    console.log('🔬 Testing AI Configuration at Runtime');
    console.log('=====================================\n');

    // Step 1: Check environment variables
    console.log('📊 Step 1: Environment Variables Status');
    console.log(`AI_PROVIDER env var: ${process.env.AI_PROVIDER || '[NOT SET]'}`);
    console.log(`OPENROUTER_API_KEY env var: ${process.env.OPENROUTER_API_KEY || '[NOT SET]'}`);
    console.log(`OPENROUTER_MODEL env var: ${process.env.OPENROUTER_MODEL || '[NOT SET]'}`);
    console.log(`SITE_URL env var: ${process.env.SITE_URL || '[NOT SET]'}`);
    console.log(`SITE_NAME env var: ${process.env.SITE_NAME || '[NOT SET]'}`);
    console.log();

    // Step 2: Test what getAIProviderConfig returns
    console.log('⚙️ Step 2: Testing getAIProviderConfig function...');
    const { getAIProviderConfig } = require('./ai-providers');

    const config = await getAIProviderConfig();
    console.log('Configuration returned:');
    console.log(`  - AI_PROVIDER: ${config.AI_PROVIDER}`);
    console.log(`  - OPENROUTER_MODEL: ${config.OPENROUTER_MODEL}`);
    console.log(`  - SITE_NAME: ${config.SITE_NAME}`);
    console.log(`  - SITE_URL: ${config.SITE_URL}`);
    console.log(`  - Has API Key: ${!!config.OPENROUTER_API_KEY}`);
    console.log();

    // Step 3: Test AI provider instantiation
    console.log('🚀 Step 3: Testing AI provider instantiation...');
    const { createAIProvider } = require('./ai-providers');

    try {
        const provider = createAIProvider(config.AI_PROVIDER, config);
        console.log(`✅ Provider created: ${config.AI_PROVIDER}`);

        if (config.AI_PROVIDER === 'openrouter') {
            console.log('OpenRouter provider details:');
            console.log(`  - Model: ${provider.model}`);
            console.log(`  - Site URL: ${provider.siteUrl}`);
            console.log(`  - Has API Key: ${!!provider.apiKey}`);
        }
    } catch (error) {
        console.log(`❌ Failed to create provider: ${error.message}`);
    }
    console.log();

    // Step 4: Test actual AI service initialization
    console.log('🤖 Step 4: Testing AI service initialization...');
    const aiService = require('./src/services/aiService');

    // This will trigger the getAIProvider function
    const provider = await aiService.getAIProvider();

    if (provider) {
        console.log('✅ AI Service initialized successfully');
        console.log(`  - Provider type: ${provider.constructor.name}`);
        if (provider.model) {
            console.log(`  - Model in use: ${provider.model}`);
        }
    } else {
        console.log('❌ AI Service failed to initialize');
    }
    console.log();

    // Step 5: Summary
    console.log('📋 SUMMARY');
    console.log('==========');
    if (config.AI_PROVIDER === 'openrouter' && config.OPENROUTER_API_KEY && !process.env.OPENROUTER_API_KEY) {
        console.log('✅ SUCCESS: System is using database configuration!');
        console.log('   - OpenRouter is configured from database');
        console.log('   - No environment variables needed');
        console.log('   - Model and credentials loaded from database');
    } else if (!config.OPENROUTER_API_KEY) {
        console.log('❌ FAILURE: Missing API key in database');
        console.log('   - Check database settings for openrouter_api_key');
    } else {
        console.log('⚠️ WARNING: Configuration source unclear');
        console.log('   - May be using mixed sources');
    }

    process.exit(0);
}

testAIConfigRuntime().catch(console.error);