/**
 * Quick test script to verify AI categorization works with real API
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const databaseClient = require('./src/utils/database');

const prisma = new PrismaClient();

async function testCategorization() {
    console.log('🧪 Testing AI Categorization...\n');

    // Initialize the database singleton
    await databaseClient.connect();

    try {
        // 1. Check if we have tickets
        const tickets = await prisma.tickets.findMany({
            take: 1,
            include: {
                messages: {
                    orderBy: { created_at: 'asc' },
                    take: 5
                }
            }
        });

        if (tickets.length === 0) {
            console.log('❌ No tickets found in database');
            return;
        }

        console.log(`✅ Found ${tickets.length} ticket(s)`);
        console.log(`   Ticket ID: ${tickets[0].id}`);
        console.log(`   Messages: ${tickets[0].messages.length}`);

        // 2. Check if we have categories
        const categories = await prisma.ticket_categories.findMany({
            where: { is_archived: false },
            take: 5
        });

        console.log(`✅ Found ${categories.length} categories`);
        categories.forEach((cat, idx) => {
            console.log(`   ${idx + 1}. ${cat.name} (${cat.id})`);
        });

        if (categories.length === 0) {
            console.log('❌ No categories available');
            return;
        }

        console.log('\n🤖 Testing AI categorization service...\n');

        // 3. Import and test the categorization service
        const aiCategorizationService = require('./src/services/aiCategorizationService');

        // Get conversation context
        const conversationContext = await aiCategorizationService.getConversationContext(tickets[0].id);
        console.log(`📝 Conversation context: ${conversationContext.length} messages`);

        // Build prompt
        const prompt = aiCategorizationService.buildCategorizationPrompt(conversationContext, categories);
        console.log('\n📋 Generated Prompt (first 500 chars):');
        console.log(prompt.substring(0, 500) + '...\n');

        // Test actual AI call
        console.log('🔄 Calling AI for categorization...');
        const result = await aiCategorizationService.callAICategorization(conversationContext, categories);

        console.log('\n✅ AI Response:');
        console.log(`   Category ID: ${result.categoryId}`);
        console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        console.log(`   Reasoning: ${result.reasoning}`);

        // Verify the category ID exists
        const matchedCategory = categories.find(c => c.id === result.categoryId);
        if (matchedCategory) {
            console.log(`   ✅ Category matched: ${matchedCategory.name}`);
        } else {
            console.log(`   ❌ Category ID not found in available categories!`);
        }

        console.log('\n🎉 Test completed successfully!');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the test
testCategorization();
