const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://simonaszilinskas@localhost:5432/vilnius_support_test'
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
  await prisma.categories.deleteMany({});
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
