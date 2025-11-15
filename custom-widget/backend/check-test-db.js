const { PrismaClient } = require('@prisma/client');

// Use environment variable for test database connection
// Falls back to standard test database URL from .env.test
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://lizdeika_user:secure_password@localhost:5434/lizdeika_support_test'
    }
  }
});

async function main() {
  console.log('Cleaning test database...');

  // Delete in correct order to respect foreign keys
  await prisma.message_statistics.deleteMany({});
  await prisma.messages.deleteMany({});
  await prisma.ticket_actions.deleteMany({});
  await prisma.tickets.deleteMany({});
  await prisma.user_activities.deleteMany({});
  await prisma.agent_status.deleteMany({});
  await prisma.refresh_tokens.deleteMany({});
  await prisma.response_templates.deleteMany({});
  await prisma.ticket_categories.deleteMany({});
  await prisma.system_logs.deleteMany({});
  await prisma.users.deleteMany({});

  console.log('Test database cleaned!');

  const userCount = await prisma.users.count();
  console.log('Remaining users:', userCount);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
