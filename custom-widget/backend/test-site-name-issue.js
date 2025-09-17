const { PrismaClient } = require('@prisma/client');

async function testSiteNameIssue() {
    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: "postgresql://vilnius_user:secure_password@localhost:5434/vilnius_support"
            }
        }
    });

    try {
        console.log('🔍 Checking site_name entries in database...');

        const siteNameEntries = await prisma.system_settings.findMany({
            where: {
                setting_key: 'site_name'
            },
            orderBy: {
                created_at: 'asc'
            }
        });

        console.log(`Found ${siteNameEntries.length} site_name entries:`);
        siteNameEntries.forEach((entry, index) => {
            console.log(`${index + 1}. ID: ${entry.id}`);
            console.log(`   Key: ${entry.setting_key}`);
            console.log(`   Value: ${entry.setting_value}`);
            console.log(`   Category: ${entry.category}`);
            console.log(`   Created: ${entry.created_at}`);
            console.log(`   Updated: ${entry.updated_at}`);
            console.log(`   Public: ${entry.is_public}`);
            console.log('');
        });

        // If we find site_name in branding category, delete it
        const brandingSiteName = siteNameEntries.find(entry => entry.category === 'branding');
        if (brandingSiteName) {
            console.log('❌ Found site_name in branding category, deleting it...');
            await prisma.system_settings.delete({
                where: { id: brandingSiteName.id }
            });
            console.log('✅ Deleted site_name from branding category');
        }

        // Check if we have site_name in ai_providers category
        const aiProvidersSiteName = siteNameEntries.find(entry => entry.category === 'ai_providers');
        if (!aiProvidersSiteName) {
            console.log('⚠️ No site_name found in ai_providers category - will be created on next save');
        } else {
            console.log('✅ site_name exists in ai_providers category');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testSiteNameIssue();