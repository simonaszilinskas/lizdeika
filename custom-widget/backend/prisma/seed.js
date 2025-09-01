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
    const admin = await prisma.users.upsert({
      where: { email: 'admin@vilnius.lt' },
      update: {},
      create: {
        id: 'admin_user_001',
        email: 'admin@vilnius.lt',
        password_hash: adminPassword,
        first_name: 'System',
        last_name: 'Administrator',
        role: 'admin',
        email_verified: true,
        is_active: true,
        updated_at: new Date(),
      },
    });
    console.log('✅ Created admin user:', admin.email);

    // Create sample agents
    const agentPassword = await bcrypt.hash('agent123', 12);
    
    const agent1 = await prisma.users.upsert({
      where: { email: 'agent1@vilnius.lt' },
      update: {},
      create: {
        id: 'agent_user_001',
        email: 'agent1@vilnius.lt',
        password_hash: agentPassword,
        first_name: 'Petras',
        last_name: 'Petraitis',
        role: 'agent',
        email_verified: true,
        is_active: true,
        updated_at: new Date(),
      },
    });

    const agent2 = await prisma.users.upsert({
      where: { email: 'agent2@vilnius.lt' },
      update: {},
      create: {
        id: 'agent_user_002',
        email: 'agent2@vilnius.lt',
        password_hash: agentPassword,
        first_name: 'Jonas',
        last_name: 'Jonaitis',
        role: 'agent',
        email_verified: true,
        is_active: true,
        updated_at: new Date(),
      },
    });

    console.log('✅ Created sample agents:', agent1.email, agent2.email);

    // Set agent statuses
    await prisma.agent_status.upsert({
      where: { user_id: agent1.id },
      update: { status: 'online', updated_at: new Date() },
      create: {
        id: agent1.id + '_status',
        user_id: agent1.id,
        status: 'online',
        updated_at: new Date(),
      },
    });

    await prisma.agent_status.upsert({
      where: { user_id: agent2.id },
      update: { status: 'offline', updated_at: new Date() },
      create: {
        id: agent2.id + '_status',
        user_id: agent2.id,
        status: 'offline',
        updated_at: new Date(),
      },
    });

    console.log('✅ Set agent statuses');

    // Create sample regular user
    const userPassword = await bcrypt.hash('user123', 12);
    const user = await prisma.users.upsert({
      where: { email: 'user@example.com' },
      update: {},
      create: {
        id: 'regular_user_001',
        email: 'user@example.com',
        password_hash: userPassword,
        first_name: 'Mantas',
        last_name: 'Mankus',
        role: 'user',
        email_verified: true,
        is_active: true,
        updated_at: new Date(),
      },
    });
    console.log('✅ Created sample user:', user.email);

    // Create sample ticket
    const ticket = await prisma.tickets.upsert({
      where: { ticket_number: 'VIL-2024-001' },
      update: {},
      create: {
        id: 'ticket_' + Date.now(),
        ticket_number: 'VIL-2024-001',
        user_id: user.id,
        assigned_agent_id: agent1.id,
        priority: 'medium',
        category: 'general',
        subject: 'Klausimas dėl gyvenamosios vietos deklaravimo',
        description: 'Norėčiau sužinoti kaip deklaruoti gyvenamąją vietą Vilniuje',
        source: 'widget',
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    console.log('✅ Created sample ticket:', ticket.ticket_number);

    // Create sample messages for the ticket
    await prisma.messages.createMany({
      data: [
        {
          id: 'msg_' + Date.now() + '_1',
          ticket_id: ticket.id,
          sender_id: user.id,
          senderType: 'user',
          content: 'Labas, norėčiau sužinoti kaip deklaruoti gyvenamąją vietą Vilniuje?',
          message_type: 'text',
        },
        {
          id: 'msg_' + Date.now() + '_2',
          ticket_id: ticket.id,
          sender_id: null, // AI response
          senderType: 'ai',
          content: 'Sveiki! Gyvenamosios vietos deklaravimui Vilniuje reikia kreiptis į...',
          message_type: 'ai_response',
        },
        {
          id: 'msg_' + Date.now() + '_3',
          ticket_id: ticket.id,
          sender_id: agent1.id,
          senderType: 'agent',
          content: 'Papildant AI atsakymą - galiu padėti su dokumentais jei reikia.',
          message_type: 'text',
        },
      ],
    });
    console.log('✅ Created sample messages');

    // Create ticket action log
    await prisma.ticket_actions.create({
      data: {
        id: 'action_' + Date.now(),
        ticket_id: ticket.id,
        performed_by: admin.id,
        action: 'assigned',
        new_value: agent1.id,
        reason: 'Automatic assignment to available agent',
        created_at: new Date(),
      },
    });
    console.log('✅ Created ticket action log');

    // Create system settings
    await prisma.system_settings.upsert({
      where: { key: 'ticket_auto_assignment' },
      update: { value: 'true', updated_by: admin.id, updated_at: new Date() },
      create: {
        id: 'setting_auto_assign',
        key: 'ticket_auto_assignment',
        value: 'true',
        updated_by: admin.id,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    await prisma.system_settings.upsert({
      where: { key: 'data_retention_months' },
      update: { value: '6', updated_by: admin.id, updated_at: new Date() },
      create: {
        id: 'setting_retention',
        key: 'data_retention_months',
        value: '6',
        updated_by: admin.id,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    console.log('✅ Created system settings');

    // Create system log entry
    await prisma.system_logs.create({
      data: {
        id: 'log_' + Date.now(),
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