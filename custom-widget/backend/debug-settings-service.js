#!/usr/bin/env node
/**
 * Debug Settings Service Issue
 */

const { PrismaClient } = require('@prisma/client');

async function debugSettingsService() {
    console.log('🔍 Debug Settings Service Database Issue');
    console.log('=====================================\n');

    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: "postgresql://vilnius_user:secure_password@localhost:5434/vilnius_support"
            }
        }
    });

    try {
        // Step 1: Direct database check
        console.log('📊 Step 1: Direct database query...');
        const directQuery = await prisma.system_settings.findMany({
            where: { category: 'ai_providers' }
        });
        console.log(`Direct query results: ${directQuery.length} records`);
        directQuery.forEach(record => {
            console.log(`  - ${record.setting_key}: ${record.setting_value}`);
        });
        console.log();

        // Step 2: Create test records
        console.log('💾 Step 2: Creating test records...');

        // Clean up first
        await prisma.system_settings.deleteMany({
            where: { category: 'ai_providers' }
        });

        // Create test records
        await prisma.system_settings.createMany({
            data: [
                {
                    setting_key: 'ai_provider',
                    setting_value: 'openrouter',
                    category: 'ai_providers',
                    is_public: false
                },
                {
                    setting_key: 'openrouter_model',
                    setting_value: 'test-model-debug',
                    category: 'ai_providers',
                    is_public: false
                }
            ]
        });
        console.log('✅ Test records created');
        console.log();

        // Step 3: Verify with direct query
        console.log('🔍 Step 3: Verification with direct query...');
        const verifyQuery = await prisma.system_settings.findMany({
            where: { category: 'ai_providers' }
        });
        console.log(`Verification query results: ${verifyQuery.length} records`);
        verifyQuery.forEach(record => {
            console.log(`  - ${record.setting_key}: ${record.setting_value}`);
        });
        console.log();

        // Step 4: Test SettingsService
        console.log('⚙️ Step 4: Testing SettingsService...');

        const SettingsService = require('./src/services/settingsService');
        const settingsService = new SettingsService();

        // Wait for initialization
        await new Promise((resolve) => {
            settingsService.once('initialized', resolve);
        });

        // Test getSettingsByCategory
        const categoryResult = await settingsService.getSettingsByCategory('ai_providers', true);
        console.log('getSettingsByCategory results:');
        console.log('Keys found:', Object.keys(categoryResult));
        Object.keys(categoryResult).forEach(key => {
            console.log(`  - ${key}: ${categoryResult[key]?.value || 'undefined'}`);
        });
        console.log();

        // Step 5: Test getAIProviderConfig
        console.log('🎯 Step 5: Testing getAIProviderConfig...');
        const aiConfig = await settingsService.getAIProviderConfig();
        console.log('AI Provider Config:');
        console.log(`  - AI_PROVIDER: ${aiConfig.AI_PROVIDER}`);
        console.log(`  - OPENROUTER_MODEL: ${aiConfig.OPENROUTER_MODEL}`);
        console.log(`  - SITE_NAME: ${aiConfig.SITE_NAME}`);

        // Check if these match our test data
        const modelMatches = aiConfig.OPENROUTER_MODEL === 'test-model-debug';
        console.log(`Model matches test data: ${modelMatches ? '✅ YES' : '❌ NO'}`);
        console.log();

        // Step 6: Check Prisma client details
        console.log('🔧 Step 6: Prisma client diagnostics...');
        console.log('SettingsService uses different Prisma client:', settingsService.prisma !== prisma);
        console.log('Test Prisma URL:', prisma._connectionString);
        console.log();

        // Cleanup
        console.log('🧹 Cleanup...');
        await prisma.system_settings.deleteMany({
            where: { category: 'ai_providers' }
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    debugSettingsService().catch(console.error);
}