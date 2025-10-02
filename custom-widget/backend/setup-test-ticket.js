const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setupTest() {
    const ticket = await prisma.tickets.findFirst({
        where: {
            archived: false,
            messages: {
                some: {}
            }
        },
        include: {
            messages: {
                orderBy: { created_at: 'desc' },
                take: 1
            }
        }
    });

    if (!ticket || !ticket.messages[0]) {
        console.log('No suitable ticket');
        return;
    }

    await prisma.tickets.update({
        where: { id: ticket.id },
        data: {
            category_id: null,
            manual_category_override: false
        }
    });

    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
    await prisma.messages.updateMany({
        where: { ticket_id: ticket.id },
        data: {
            created_at: twentyMinutesAgo
        }
    });

    const msgCount = await prisma.messages.count({
        where: { ticket_id: ticket.id }
    });

    console.log('✅ Test ticket ready:', ticket.id);
    console.log('   - No category');
    console.log('   - ' + msgCount + ' messages');
    console.log('   - All messages 20 minutes old');

    await prisma.$disconnect();
}

setupTest().catch(console.error);
