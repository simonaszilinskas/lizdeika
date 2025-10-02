const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testManualOverride() {
    try {
        console.log('🧪 Testing Manual Category Override\n');

        // Find our test ticket
        const ticket = await prisma.tickets.findFirst({
            where: {
                category_id: null,
                archived: false
            }
        });

        if (!ticket) {
            console.log('❌ No test ticket found');
            return;
        }

        console.log(`✅ Using ticket: ${ticket.id}`);
        console.log(`   Current category: ${ticket.category_id || 'None'}`);
        console.log(`   Manual override: ${ticket.manual_category_override}\n`);

        // Test 1: Simulate manual category assignment
        console.log('📝 Test 1: Manual category assignment');
        const conversationService = require('./src/services/conversationService');

        // Get a category to assign
        const category = await prisma.ticket_categories.findFirst({
            where: { is_archived: false }
        });

        if (!category) {
            console.log('❌ No categories available');
            return;
        }

        console.log(`   Assigning category: ${category.name}`);
        await conversationService.updateConversationCategory(ticket.id, category.id, true);

        const afterAssignment = await prisma.tickets.findUnique({
            where: { id: ticket.id },
            select: {
                category_id: true,
                manual_category_override: true,
                category_metadata: true
            }
        });

        console.log(`   ✓ Category ID: ${afterAssignment.category_id}`);
        console.log(`   ✓ Manual override: ${afterAssignment.manual_category_override}`);
        console.log(`   ✓ AI metadata cleared: ${afterAssignment.category_metadata === null}\n`);

        if (!afterAssignment.manual_category_override) {
            console.log('❌ FAIL: manual_category_override should be true after manual assignment');
            return;
        }

        // Test 2: Check eligibility (should be rejected due to manual override)
        console.log('📝 Test 2: AI categorization eligibility check');
        const aiCategorizationService = require('./src/services/aiCategorizationService');

        // First remove the category to test
        await prisma.tickets.update({
            where: { id: ticket.id },
            data: { category_id: null }
        });

        const eligibility = await aiCategorizationService.isEligibleForCategorization(ticket.id);

        console.log(`   Eligible: ${eligibility.eligible}`);
        console.log(`   Reason: ${eligibility.reason}\n`);

        if (eligibility.eligible) {
            console.log('❌ FAIL: Ticket with manual_category_override=true should NOT be eligible');
            return;
        }

        if (!eligibility.reason.includes('Manual category override')) {
            console.log('❌ FAIL: Reason should mention manual override');
            return;
        }

        // Test 3: Re-enable AI control
        console.log('📝 Test 3: Re-enable AI categorization');
        await prisma.tickets.update({
            where: { id: ticket.id },
            data: { manual_category_override: false }
        });

        const eligibilityAfter = await aiCategorizationService.isEligibleForCategorization(ticket.id);

        console.log(`   Eligible: ${eligibilityAfter.eligible}`);
        console.log(`   Reason: ${eligibilityAfter.reason || 'N/A'}\n`);

        if (!eligibilityAfter.eligible && eligibilityAfter.reason.includes('Manual category override')) {
            console.log('❌ FAIL: Ticket should be eligible after disabling manual override');
            return;
        }

        console.log('✅ All tests passed!\n');
        console.log('Summary:');
        console.log('  ✓ Manual assignment sets manual_category_override = true');
        console.log('  ✓ AI respects manual_category_override flag');
        console.log('  ✓ Manual override can be toggled off to re-enable AI');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

testManualOverride();
