#!/usr/bin/env node
/**
 * Debug Database Write Test
 * Simple test to verify we can write to system_settings table
 */

const { PrismaClient } = require('@prisma/client');

async function debugDbWrite() {
    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: "postgresql://vilnius_user:secure_password@localhost:5434/vilnius_support"
            }
        }
    });

    try {
        console.log('🔧 Debug: Testing database write operations...');

        // Step 1: Check current state
        console.log('\n📊 Step 1: Current system_settings entries');
        const allSettings = await prisma.system_settings.findMany();
        console.log(`Total settings: ${allSettings.length}`);

        const aiSettings = await prisma.system_settings.findMany({
            where: { category: 'ai_providers' }
        });
        console.log(`AI provider settings: ${aiSettings.length}`);

        // Step 2: Try to create a simple record
        console.log('\n🔧 Step 2: Creating test record...');
        const testRecord = await prisma.system_settings.create({
            data: {
                setting_key: 'test_debug_key',
                setting_value: 'test_value',
                category: 'ai_providers',
                is_public: false
            }
        });
        console.log('✅ Test record created:', testRecord.id);

        // Step 3: Verify record exists
        console.log('\n🔍 Step 3: Verifying record...');
        const verifyRecord = await prisma.system_settings.findUnique({
            where: { setting_key: 'test_debug_key' }
        });
        console.log('Found record:', verifyRecord ? 'YES' : 'NO');

        // Step 4: Try the actual AI provider record
        console.log('\n🎯 Step 4: Testing actual AI provider record...');

        // Delete any existing openrouter_model
        await prisma.system_settings.deleteMany({
            where: { setting_key: 'openrouter_model' }
        });

        const aiRecord = await prisma.system_settings.create({
            data: {
                setting_key: 'openrouter_model',
                setting_value: 'test/debug-model',
                category: 'ai_providers',
                is_public: false
            }
        });
        console.log('✅ AI provider record created:', aiRecord.id);

        // Step 5: Check final state
        console.log('\n📋 Step 5: Final verification...');
        const finalAiSettings = await prisma.system_settings.findMany({
            where: { category: 'ai_providers' }
        });
        console.log(`AI provider settings after test: ${finalAiSettings.length}`);
        finalAiSettings.forEach(setting => {
            console.log(`  - ${setting.setting_key}: ${setting.setting_value}`);
        });

        // Clean up
        console.log('\n🧹 Cleanup...');
        await prisma.system_settings.deleteMany({
            where: {
                setting_key: {
                    in: ['test_debug_key', 'openrouter_model']
                }
            }
        });
        console.log('✅ Cleanup complete');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    debugDbWrite().catch(console.error);
}