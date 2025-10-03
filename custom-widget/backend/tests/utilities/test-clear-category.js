const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const conversationService = require('../../src/services/conversationService');

async function testClearCategory() {
    try {
        console.log('🧪 Testing Category Removal with Manual Override\n');

        const ticket = await prisma.tickets.findFirst({
            where: { category_id: { not: null } }
        });

        if (!ticket) {
            console.log('No ticket with category found');
            return;
        }

        console.log('Before removal:');
        console.log('  Category:', ticket.category_id);
        console.log('  Manual override:', ticket.manual_category_override);

        // Remove category (simulating agent action)
        await conversationService.updateConversationCategory(ticket.id, null, true);

        const after = await prisma.tickets.findUnique({
            where: { id: ticket.id }
        });

        console.log('\nAfter removal:');
        console.log('  Category:', after.category_id || 'None');
        console.log('  Manual override:', after.manual_category_override);

        if (after.manual_category_override) {
            console.log('\n✅ SUCCESS: Manual override flag set when agent clears category');
        } else {
            console.log('\n❌ FAIL: Manual override should be true');
        }
    } catch (error) {
        console.error('Test failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

testClearCategory().catch(console.error);
