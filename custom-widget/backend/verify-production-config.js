#!/usr/bin/env node
/**
 * Production Configuration Verification
 *
 * This script verifies that the AI provider configuration is correctly
 * loaded from the production database and used by the system.
 */

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

async function verifyProductionConfig() {
    console.log('🔍 Production AI Configuration Verification');
    console.log('==========================================\n');

    // Use the actual production database from .env
    const prisma = new PrismaClient();

    try {
        // Step 1: Check database configuration
        console.log('📊 Step 1: Checking database configuration...');
        console.log(`DATABASE_URL: ${process.env.DATABASE_URL?.replace(/:[^@]+@/, ':***@')}\n`);

        const aiSettings = await prisma.system_settings.findMany({
            where: { category: 'ai_providers' },
            orderBy: { setting_key: 'asc' }
        });

        console.log(`Found ${aiSettings.length} AI provider settings in database:`);
        aiSettings.forEach(setting => {
            const displayValue = setting.setting_key.includes('key') ? '[HIDDEN]' : setting.setting_value;
            console.log(`  ✓ ${setting.setting_key}: ${displayValue}`);
        });
        console.log();

        // Step 2: Test SettingsService loading
        console.log('⚙️ Step 2: Testing SettingsService configuration loading...');
        const SettingsService = require('./src/services/settingsService');
        const settingsService = new SettingsService();

        await new Promise((resolve) => {
            settingsService.once('initialized', resolve);
        });

        const config = await settingsService.getAIProviderConfig();
        console.log('Configuration loaded by SettingsService:');
        console.log(`  - Provider: ${config.AI_PROVIDER}`);
        console.log(`  - Model: ${config.OPENROUTER_MODEL}`);
        console.log(`  - Site Name: ${config.SITE_NAME}`);
        console.log(`  - Site URL: ${config.SITE_URL}`);
        console.log();

        // Step 3: Verify values match database
        console.log('🔬 Step 3: Verifying database values are used...');
        const dbProvider = aiSettings.find(s => s.setting_key === 'ai_provider')?.setting_value;
        const dbModel = aiSettings.find(s => s.setting_key === 'openrouter_model')?.setting_value;
        const dbSiteName = aiSettings.find(s => s.setting_key === 'site_name')?.setting_value;

        const checks = [
            {
                name: 'AI Provider',
                dbValue: dbProvider,
                configValue: config.AI_PROVIDER,
                matches: dbProvider === config.AI_PROVIDER
            },
            {
                name: 'Model',
                dbValue: dbModel,
                configValue: config.OPENROUTER_MODEL,
                matches: dbModel === config.OPENROUTER_MODEL
            },
            {
                name: 'Site Name',
                dbValue: dbSiteName,
                configValue: config.SITE_NAME,
                matches: !dbSiteName || dbSiteName === config.SITE_NAME
            }
        ];

        checks.forEach(check => {
            const status = check.matches ? '✅' : '❌';
            console.log(`${status} ${check.name}:`);
            console.log(`    Database: ${check.dbValue || '[NOT SET]'}`);
            console.log(`    Config:   ${check.configValue}`);
            if (!check.matches && check.dbValue) {
                console.log(`    ⚠️  Config is using fallback instead of database value!`);
            }
        });
        console.log();

        // Step 4: Test AI Provider instantiation
        console.log('🚀 Step 4: Testing AI provider instantiation...');
        const { createAIProvider } = require('./ai-providers');

        try {
            const provider = createAIProvider(config.AI_PROVIDER, config);
            console.log('✅ AI Provider instantiated successfully');

            if (config.AI_PROVIDER === 'openrouter') {
                console.log(`  - Using model: ${provider.model}`);
                console.log(`  - Site URL: ${provider.siteUrl}`);
            }
        } catch (error) {
            console.log(`❌ AI Provider instantiation failed: ${error.message}`);
        }
        console.log();

        // Step 5: Summary
        console.log('📋 VERIFICATION SUMMARY');
        console.log('=======================');

        const allChecksPass = checks.every(c => c.matches);
        const hasSiteName = !!dbSiteName;

        if (allChecksPass && hasSiteName) {
            console.log('✅ SUCCESS: All database values are being used correctly!');
            console.log('   - Site name persists correctly');
            console.log('   - Database configuration overrides environment variables');
            console.log('   - Production system uses the configured AI model');
        } else if (!hasSiteName) {
            console.log('⚠️  WARNING: Site name is missing from database');
            console.log('   - This causes the site name to disappear on reload');
            console.log('   - Add site_name to database to fix this issue');
        } else {
            console.log('❌ FAILURE: Some database values are not being used');
            console.log('   - Check cache invalidation');
            console.log('   - Verify database connection');
        }

    } catch (error) {
        console.error('❌ Verification failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run verification
if (require.main === module) {
    verifyProductionConfig().catch(console.error);
}

module.exports = { verifyProductionConfig };