/**
 * Vilnius Assistant - Database Seeder
 * Creates initial data for Phase 3 development and testing
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  try {
    // Create default admin user
    const adminPassword = await bcrypt.hash('admin123', 12);
    const admin = await prisma.user.upsert({
      where: { email: 'admin@vilnius.lt' },
      update: {},
      create: {
        email: 'admin@vilnius.lt',
        passwordHash: adminPassword,
        firstName: 'System',
        lastName: 'Administrator',
        role: 'admin',
        emailVerified: true,
        isActive: true,
      },
    });
    console.log('✅ Created admin user:', admin.email);

    // Create sample agents
    const agentPassword = await bcrypt.hash('agent123', 12);
    
    const agent1 = await prisma.user.upsert({
      where: { email: 'agent1@vilnius.lt' },
      update: {},
      create: {
        email: 'agent1@vilnius.lt',
        passwordHash: agentPassword,
        firstName: 'Petras',
        lastName: 'Petraitis',
        role: 'agent',
        emailVerified: true,
        isActive: true,
      },
    });

    const agent2 = await prisma.user.upsert({
      where: { email: 'agent2@vilnius.lt' },
      update: {},
      create: {
        email: 'agent2@vilnius.lt',
        passwordHash: agentPassword,
        firstName: 'Jonas',
        lastName: 'Jonaitis',
        role: 'agent',
        emailVerified: true,
        isActive: true,
      },
    });

    console.log('✅ Created sample agents:', agent1.email, agent2.email);

    // Set agent statuses
    await prisma.agentStatus.upsert({
      where: { userId: agent1.id },
      update: { status: 'online' },
      create: {
        userId: agent1.id,
        status: 'online',
      },
    });

    await prisma.agentStatus.upsert({
      where: { userId: agent2.id },
      update: { status: 'offline' },
      create: {
        userId: agent2.id,
        status: 'offline',
      },
    });

    console.log('✅ Set agent statuses');

    // Create sample regular user
    const userPassword = await bcrypt.hash('user123', 12);
    const user = await prisma.user.upsert({
      where: { email: 'user@example.com' },
      update: {},
      create: {
        email: 'user@example.com',
        passwordHash: userPassword,
        firstName: 'Mantas',
        lastName: 'Mankus',
        role: 'user',
        emailVerified: true,
        isActive: true,
      },
    });
    console.log('✅ Created sample user:', user.email);

    // Create sample ticket
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: 'VIL-2024-001',
        userId: user.id,
        assignedAgentId: agent1.id,
        status: 'open',
        priority: 'medium',
        category: 'general',
        subject: 'Klausimas dėl gyvenamosios vietos deklaravimo',
        description: 'Norėčiau sužinoti kaip deklaruoti gyvenamąją vietą Vilniuje',
        source: 'widget',
      },
    });
    console.log('✅ Created sample ticket:', ticket.ticketNumber);

    // Create sample messages for the ticket
    await prisma.message.createMany({
      data: [
        {
          ticketId: ticket.id,
          senderId: user.id,
          senderType: 'user',
          content: 'Labas, norėčiau sužinoti kaip deklaruoti gyvenamąją vietą Vilniuje?',
          messageType: 'text',
        },
        {
          ticketId: ticket.id,
          senderId: null, // AI response
          senderType: 'ai',
          content: 'Sveiki! Gyvenamosios vietos deklaravimui Vilniuje reikia kreiptis į...',
          messageType: 'ai_response',
        },
        {
          ticketId: ticket.id,
          senderId: agent1.id,
          senderType: 'agent',
          content: 'Papildant AI atsakymą - galiu padėti su dokumentais jei reikia.',
          messageType: 'text',
        },
      ],
    });
    console.log('✅ Created sample messages');

    // Create ticket action log
    await prisma.ticketAction.create({
      data: {
        ticketId: ticket.id,
        performedBy: admin.id,
        action: 'assigned',
        newValue: agent1.id,
        reason: 'Automatic assignment to available agent',
      },
    });
    console.log('✅ Created ticket action log');

    // Create system settings
    await prisma.systemSetting.upsert({
      where: { key: 'ticket_auto_assignment' },
      update: { value: 'true', updatedBy: admin.id },
      create: {
        key: 'ticket_auto_assignment',
        value: 'true',
        updatedBy: admin.id,
      },
    });

    await prisma.systemSetting.upsert({
      where: { key: 'data_retention_months' },
      update: { value: '6', updatedBy: admin.id },
      create: {
        key: 'data_retention_months',
        value: '6',
        updatedBy: admin.id,
      },
    });

    console.log('✅ Created system settings');

    // Create system log entry
    await prisma.systemLog.create({
      data: {
        action: 'database_seeded',
        details: {
          users_created: 3,
          tickets_created: 1,
          messages_created: 3,
          timestamp: new Date().toISOString(),
        },
      },
    });
    console.log('✅ Created system log entry');

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\nDefault credentials:');
    console.log('Admin: admin@vilnius.lt / admin123');
    console.log('Agent 1: agent1@vilnius.lt / agent123 (online)');
    console.log('Agent 2: agent2@vilnius.lt / agent123 (offline)');
    console.log('User: user@example.com / user123');
    console.log('\nSample ticket: VIL-2024-001');

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });