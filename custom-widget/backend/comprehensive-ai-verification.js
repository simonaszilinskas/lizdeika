#!/usr/bin/env node
/**
 * Comprehensive AI Provider Configuration Verification
 *
 * This script provides comprehensive verification that the AI provider
 * configuration system works correctly in production.
 */

const { PrismaClient } = require('@prisma/client');

async function comprehensiveVerification() {
    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: "postgresql://vilnius_user:secure_password@localhost:5434/vilnius_support"
            }
        }
    });

    console.log('🔬 Comprehensive AI Provider Configuration Verification');
    console.log('=========================================================\n');

    try {
        // Step 1: Clean start - ensure no AI provider settings exist
        console.log('🧹 Step 1: Cleaning existing AI provider settings...');
        await prisma.system_settings.deleteMany({
            where: { category: 'ai_providers' }
        });
        console.log('✅ Clean slate established\n');

        // Step 2: Test environment fallback behavior
        console.log('🌍 Step 2: Testing environment variable fallback...');

        // Create a fresh SettingsService instance
        const SettingsService = require('./src/services/settingsService');
        const settingsService1 = new SettingsService();

        // Wait for initialization
        await new Promise((resolve) => {
            settingsService1.once('initialized', resolve);
        });

        const envConfig = await settingsService1.getAIProviderConfig();
        console.log(`✅ Environment fallback works:`);
        console.log(`  - Provider: ${envConfig.AI_PROVIDER}`);
        console.log(`  - Model: ${envConfig.OPENROUTER_MODEL}`);
        console.log(`  - Site Name: ${envConfig.SITE_NAME}\n`);

        // Step 3: Add database settings and verify override
        console.log('💾 Step 3: Adding database settings...');

        const dbModel = 'google/gemini-2.5-flash-production-test';
        const dbSiteName = 'Production Test Site Database';

        // Create database settings
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
                    setting_value: dbModel,
                    category: 'ai_providers',
                    is_public: false
                },
                {
                    setting_key: 'site_name',
                    setting_value: dbSiteName,
                    category: 'ai_providers',
                    is_public: false
                }
            ]
        });
        console.log('✅ Database settings created\n');

        // Step 4: Create NEW settings service instance (to avoid cache)
        console.log('🔄 Step 4: Testing database override with fresh instance...');

        const settingsService2 = new SettingsService();
        await new Promise((resolve) => {
            settingsService2.once('initialized', resolve);
        });

        const dbConfig = await settingsService2.getAIProviderConfig();
        console.log(`Database configuration loaded:`);
        console.log(`  - Provider: ${dbConfig.AI_PROVIDER}`);
        console.log(`  - Model: ${dbConfig.OPENROUTER_MODEL}`);
        console.log(`  - Site Name: ${dbConfig.SITE_NAME}`);

        const databaseOverrideWorks = (
            dbConfig.OPENROUTER_MODEL === dbModel &&
            dbConfig.SITE_NAME === dbSiteName
        );

        if (databaseOverrideWorks) {
            console.log('✅ Database correctly overrides environment variables!\n');
        } else {
            console.log('❌ Database override FAILED!');
            console.log(`  Expected model: ${dbModel}, got: ${dbConfig.OPENROUTER_MODEL}`);
            console.log(`  Expected site name: ${dbSiteName}, got: ${dbConfig.SITE_NAME}\n`);
        }

        // Step 5: Test AI provider instantiation
        console.log('🚀 Step 5: Testing AI provider instantiation...');

        const { createAIProvider } = require('./ai-providers');
        let providerWorksCorrectly = false;

        try {
            const provider = createAIProvider(dbConfig.AI_PROVIDER, dbConfig);
            providerWorksCorrectly = (
                provider.model === dbModel &&
                provider.apiKey && // Should have some API key
                provider.siteUrl
            );

            if (providerWorksCorrectly) {
                console.log('✅ AI provider instance created with database configuration');
                console.log(`  - Model in provider: ${provider.model}`);
                console.log(`  - Site URL: ${provider.siteUrl}`);
            } else {
                console.log('❌ AI provider instance does not match database configuration');
            }
        } catch (error) {
            console.log(`❌ AI provider instantiation failed: ${error.message}`);
        }
        console.log();

        // Step 6: Test real-world scenario simulation
        console.log('🎯 Step 6: Testing real-world scenario simulation...');

        // Simulate what happens during an actual AI request
        const { getAIProviderConfig } = require('./ai-providers');
        const realWorldConfig = await getAIProviderConfig();

        const realWorldTest = (
            realWorldConfig.OPENROUTER_MODEL === dbModel &&
            realWorldConfig.SITE_NAME === dbSiteName
        );

        if (realWorldTest) {
            console.log('✅ Real-world scenario test PASSED');
            console.log('  The production system will use database configuration');
        } else {
            console.log('❌ Real-world scenario test FAILED');
            console.log('  The production system may not use database configuration');
        }
        console.log();

        // Final Summary
        console.log('📋 COMPREHENSIVE VERIFICATION SUMMARY');
        console.log('=====================================');

        const tests = [
            {
                name: 'Environment fallback works',
                passed: envConfig && envConfig.AI_PROVIDER
            },
            {
                name: 'Database settings can be created',
                passed: true // We got this far
            },
            {
                name: 'Database overrides environment',
                passed: databaseOverrideWorks
            },
            {
                name: 'AI provider instantiation works',
                passed: providerWorksCorrectly
            },
            {
                name: 'Real-world scenario works',
                passed: realWorldTest
            }
        ];

        tests.forEach((test, index) => {
            const status = test.passed ? '✅ PASS' : '❌ FAIL';
            console.log(`${index + 1}. ${test.name}: ${status}`);
        });

        const allTestsPassed = tests.every(test => test.passed);
        console.log('\n' + '='.repeat(50));
        console.log(`🎯 OVERALL RESULT: ${allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ TESTS FAILED'}`);
        console.log('='.repeat(50));

        if (allTestsPassed) {
            console.log('\n🎉 EXCELLENT! The AI provider configuration system is working correctly!');
            console.log('   ✅ Database settings properly override environment variables');
            console.log('   ✅ AI providers are instantiated with correct database configuration');
            console.log('   ✅ Production systems will use the configured settings');
        } else {
            console.log('\n⚠️  ATTENTION: There are issues with the AI provider configuration:');
            tests.filter(test => !test.passed).forEach(test => {
                console.log(`   ❌ ${test.name}`);
            });
            console.log('\n   This means the production system may not use the settings configured in the UI.');
        }

        // Cleanup
        console.log('\n🧹 Cleaning up test data...');
        await prisma.system_settings.deleteMany({
            where: { category: 'ai_providers' }
        });
        console.log('✅ Cleanup complete');

    } catch (error) {
        console.error('\n❌ Verification failed with error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    comprehensiveVerification().catch(console.error);
}