const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const service = require('../../src/services/aiCategorizationService');

async function testInactivityDetection() {
    try {
        console.log('🧪 Testing Inactivity Detection...\n');

        // Use the specific test ticket we just created
        const ticketId = 'ticket_1757325209692';

        const ticketWithMessages = await prisma.tickets.findUnique({
            where: { id: ticketId },
            include: {
                messages: {
                    orderBy: { created_at: 'desc' },
                    take: 1
                }
            }
        });

        if (!ticketWithMessages) {
            console.log('❌ Test ticket not found');
            return;
        }

        console.log(`✅ Testing ticket: ${ticketWithMessages.id}`);

        const messageCount = await prisma.messages.count({
            where: { ticket_id: ticketWithMessages.id }
        });

        console.log(`   Messages: ${messageCount}`);

        if (ticketWithMessages.messages[0]) {
            const lastMsgTime = new Date(ticketWithMessages.messages[0].created_at);
            const minutesAgo = (Date.now() - lastMsgTime.getTime()) / (1000 * 60);
            console.log(`   Last message: ${minutesAgo.toFixed(0)} minutes ago`);
        }

        // Test eligibility
        console.log('\n🔍 Testing eligibility check...\n');
        const eligibility = await service.isEligibleForCategorization(ticketWithMessages.id);

        console.log(`Eligible: ${eligibility.eligible}`);
        if (!eligibility.eligible) {
            console.log(`Reason: ${eligibility.reason}`);
        }

        console.log('\n📋 Configuration:');
        console.log(`   ENABLE_AUTO_CATEGORIZATION: ${process.env.ENABLE_AUTO_CATEGORIZATION !== 'false'}`);
        console.log(`   AUTO_CATEGORIZATION_IDLE_MINUTES: ${process.env.AUTO_CATEGORIZATION_IDLE_MINUTES || '15'}`);
        console.log(`   AUTO_CATEGORIZATION_MIN_MESSAGES: ${process.env.AUTO_CATEGORIZATION_MIN_MESSAGES || '3'}`);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

testInactivityDetection();
