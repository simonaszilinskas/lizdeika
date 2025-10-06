/**
 * Vilnius Assistant - Minimal Database Seeder
 * Creates only essential data for development and testing
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting minimal database seeding...');

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

    // Create one sample agent
    const agentPassword = await bcrypt.hash('agent123', 12);

    const agent = await prisma.users.upsert({
      where: { email: 'agent@vilnius.lt' },
      update: {},
      create: {
        id: 'agent_user_001',
        email: 'agent@vilnius.lt',
        password_hash: agentPassword,
        first_name: 'Test',
        last_name: 'Agent',
        role: 'agent',
        email_verified: true,
        is_active: true,
        updated_at: new Date(),
      },
    });

    console.log('✅ Created sample agent:', agent.email);

    // Set agent status
    await prisma.agent_status.upsert({
      where: { user_id: agent.id },
      update: { status: 'online', updated_at: new Date() },
      create: {
        id: agent.id + '_status',
        user_id: agent.id,
        status: 'online',
        updated_at: new Date(),
      },
    });

    console.log('✅ Set agent status');

    // Create one sample user
    const userPassword = await bcrypt.hash('user123', 12);
    const user = await prisma.users.upsert({
      where: { email: 'user@example.com' },
      update: {},
      create: {
        id: 'regular_user_001',
        email: 'user@example.com',
        password_hash: userPassword,
        first_name: 'Test',
        last_name: 'User',
        role: 'user',
        email_verified: true,
        is_active: true,
        updated_at: new Date(),
      },
    });
    console.log('✅ Created sample user:', user.email);

    // Create one simple ticket
    const ticket = await prisma.tickets.upsert({
      where: { ticket_number: 'VIL-2024-001' },
      update: {},
      create: {
        id: 'e72ee248-07a6-4671-8f71-953f7ef88459',
        ticket_number: 'VIL-2024-001',
        user_id: user.id,
        assigned_agent_id: agent.id,
        priority: 'medium',
        category: 'general',
        subject: 'Test klausimas',
        description: 'Paprastas klausimas testavimui',
        source: 'widget',
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    console.log('✅ Created sample ticket:', ticket.ticket_number);

    // Create one simple message
    await prisma.messages.create({
      data: {
        id: 'e4d924be-f718-4279-84ec-1eb975c70e36',
        ticket_id: ticket.id,
        sender_id: user.id,
        senderType: 'user',
        content: 'Sveiki, ar galite padėti?',
        message_type: 'text',
        created_at: new Date(),
      },
    });
    console.log('✅ Created sample message');

    // Create default branding settings including privacy checkbox text
    const defaultBrandingSettings = [
      {
        setting_key: 'privacy_checkbox_text',
        setting_value: process.env.PRIVACY_CHECKBOX_TEXT || 'I agree to the Privacy Policy and Terms of Service.',
        setting_type: 'string',
        description: 'Text shown in the privacy policy checkbox (supports Markdown)',
        category: 'branding',
        is_public: true,
      },
    ];

    for (const setting of defaultBrandingSettings) {
      await prisma.system_settings.upsert({
        where: { setting_key: setting.setting_key },
        update: {},
        create: {
          id: `setting_${setting.setting_key}`,
          ...setting,
        },
      });
    }
    console.log('✅ Created default branding settings');

    console.log('\n🎉 Minimal database seeding completed successfully!');
    console.log('\nDefault credentials:');
    console.log('Admin: admin@vilnius.lt / admin123');
    console.log('Agent: agent@vilnius.lt / agent123');
    console.log('User: user@example.com / user123');
    console.log('\nSample ticket: VIL-2024-001 (with 1 message)');

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