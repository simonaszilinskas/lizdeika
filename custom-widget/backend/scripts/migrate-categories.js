/**
 * Category Migration Script
 *
 * Migrates existing string categories to the new ticket_categories table
 * and updates ticket references to use category_id foreign keys.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateCategories() {
  console.log('🚀 Starting category migration...');

  try {
    await prisma.$transaction(async (tx) => {
      // Step 1: Get all unique categories from tickets
      console.log('📊 Analyzing existing categories...');

      const existingCategories = await tx.$queryRaw`
        SELECT DISTINCT
          TRIM(REGEXP_REPLACE(category, '\s+', ' ', 'g')) as clean_name,
          COUNT(*) as usage_count,
          MIN(created_at) as first_used,
          COALESCE(
            MODE() WITHIN GROUP (ORDER BY assigned_agent_id) FILTER (WHERE assigned_agent_id IS NOT NULL),
            (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1)
          ) as owner_id
        FROM tickets
        WHERE category IS NOT NULL
          AND TRIM(category) != ''
          AND LENGTH(TRIM(category)) <= 100
        GROUP BY TRIM(REGEXP_REPLACE(category, '\s+', ' ', 'g'))
        ORDER BY usage_count DESC
      `;

      console.log(`📋 Found ${existingCategories.length} unique categories to migrate`);

      if (existingCategories.length === 0) {
        console.log('✅ No categories to migrate');
        return;
      }

      // Check for existing categories to prevent duplicates
      const existingCategoryNames = await tx.ticket_categories.findMany({
        select: { name: true }
      });
      const existingNameSet = new Set(existingCategoryNames.map(c => c.name));

      // Step 2: Handle name collisions and create canonical categories
      const categoryMap = new Map();
      const createdCategories = [];

      for (const cat of existingCategories) {
        let finalName = cat.clean_name;
        let counter = 1;

        // Handle name collisions by appending numbers
        while (categoryMap.has(finalName) || existingNameSet.has(finalName)) {
          counter++;
          finalName = `${cat.clean_name} (${counter})`;
        }

        console.log(`📝 Creating category: "${finalName}" (${cat.usage_count} tickets)`);

        const newCategory = await tx.ticket_categories.create({
          data: {
            name: finalName,
            created_by: cat.owner_id,
            created_at: cat.first_used,
            color: '#6B7280' // Default color
          }
        });

        categoryMap.set(cat.clean_name, newCategory.id);
        createdCategories.push({
          originalName: cat.clean_name,
          finalName: finalName,
          id: newCategory.id,
          usageCount: cat.usage_count
        });
      }

      // Step 3: Update tickets with new category_id references
      console.log('🔗 Updating ticket references...');

      let updatedTickets = 0;
      let orphanedTickets = 0;

      for (const category of createdCategories) {
        const result = await tx.$executeRaw`
          UPDATE tickets
          SET category_id = ${category.id}
          WHERE TRIM(REGEXP_REPLACE(category, '\s+', ' ', 'g')) = ${category.originalName}
            AND category_id IS NULL
        `;

        updatedTickets += result;
        console.log(`   ✓ Updated ${result} tickets for category "${category.finalName}"`);
      }

      // Step 4: Check for orphaned tickets
      const orphanedResult = await tx.$queryRaw`
        SELECT COUNT(*) as count
        FROM tickets
        WHERE category IS NOT NULL
          AND TRIM(category) != ''
          AND category_id IS NULL
      `;

      orphanedTickets = orphanedResult[0]?.count || 0;

      // Step 5: Log migration results
      const migrationLog = {
        categories_created: createdCategories.length,
        tickets_migrated: updatedTickets,
        orphaned_tickets: orphanedTickets,
        created_categories: createdCategories.map(c => ({
          name: c.finalName,
          original: c.originalName,
          usage_count: c.usageCount
        }))
      };

      await tx.system_logs.create({
        data: {
          id: `migration-${Date.now()}`,
          action: 'category_migration_complete',
          details: migrationLog
        }
      });

      // Step 6: Summary
      console.log('\n🎉 Migration completed successfully!');
      console.log(`   📊 Categories created: ${createdCategories.length}`);
      console.log(`   🎫 Tickets migrated: ${updatedTickets}`);

      if (orphanedTickets > 0) {
        console.log(`   ⚠️  Orphaned tickets: ${orphanedTickets}`);
        console.log('      (These tickets have categories that couldn\'t be migrated)');
      }

      console.log('\n📋 Created categories:');
      createdCategories.forEach(cat => {
        console.log(`   • "${cat.finalName}" (${cat.usageCount} tickets)`);
      });
    }); // end transaction

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Rollback function for emergencies
async function rollbackMigration() {
  console.log('🔄 Starting migration rollback...');

  try {
    // Remove category_id references
    await prisma.$executeRaw`UPDATE tickets SET category_id = NULL WHERE category_id IS NOT NULL`;

    // Delete all migrated categories
    const deletedCount = await prisma.ticket_categories.deleteMany({});

    console.log(`✅ Rollback completed. Removed ${deletedCount.count} categories`);

  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// CLI interface
if (require.main === module) {
  const action = process.argv[2];

  if (action === 'rollback') {
    rollbackMigration().catch(console.error);
  } else {
    migrateCategories().catch(console.error);
  }
}

module.exports = { migrateCategories, rollbackMigration };