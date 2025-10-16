/**
 * Test Database Utilities
 *
 * Provides utilities for setting up and cleaning the test database
 * for integration tests. Uses a real PostgreSQL database (not mocks).
 *
 * Key Features:
 * - Database connection management
 * - Data cleanup between tests
 * - Schema synchronization
 * - Test isolation
 */

const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

let prisma = null;

/**
 * Initialize test database connection
 * Connects to the test database specified in .env.test
 */
async function initializeTestDatabase() {
  if (prisma) {
    return prisma;
  }

  // Ensure we're in test environment
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Test database can only be initialized in test environment');
  }

  prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: [], // Disable logging in tests
  });

  await prisma.$connect();
  return prisma;
}

/**
 * Clean all data from test database
 * Removes all records while preserving schema
 * Order matters due to foreign key constraints
 */
async function cleanTestDatabase() {
  if (!prisma) {
    await initializeTestDatabase();
  }

  try {
    // Delete in order to respect foreign key constraints
    await prisma.$transaction([
      // Delete dependent records first
      prisma.message_statistics.deleteMany(),
      prisma.messages.deleteMany(),
      prisma.ticket_actions.deleteMany(),
      prisma.tickets.deleteMany(),

      // Delete user-related records
      prisma.user_activities.deleteMany(),
      prisma.agent_status.deleteMany(),
      prisma.refresh_tokens.deleteMany(),

      // Delete configuration data
      prisma.response_templates.deleteMany(),
      prisma.ticket_categories.deleteMany(),

      // Delete logs
      prisma.system_logs.deleteMany(),
      prisma.application_logs.deleteMany(),

      // Delete users last (referenced by many tables)
      prisma.users.deleteMany(),

      // Note: Don't delete system_settings as they contain config
    ]);
  } catch (error) {
    console.error('Error cleaning test database:', error);
    throw error;
  }
}

/**
 * Synchronize database schema with Prisma schema
 * Uses db push to ensure test database matches schema
 */
async function synchronizeSchema() {
  try {
    // Use db push instead of migrate for test database
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      cwd: __dirname + '/../../..',
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL,
      },
      stdio: 'pipe', // Suppress output
    });
  } catch (error) {
    console.error('Error synchronizing schema:', error);
    throw error;
  }
}

/**
 * Close test database connection
 * Should be called in afterAll hook
 */
async function closeTestDatabase() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

/**
 * Get Prisma client instance for tests
 */
function getTestClient() {
  if (!prisma) {
    throw new Error('Test database not initialized. Call initializeTestDatabase() first.');
  }
  return prisma;
}

/**
 * Reset test database to clean state
 * Combines cleanup and schema sync
 */
async function resetTestDatabase() {
  await initializeTestDatabase();
  await cleanTestDatabase();
  // Schema sync only needed if schema changed
  // await synchronizeSchema();
}

module.exports = {
  initializeTestDatabase,
  cleanTestDatabase,
  synchronizeSchema,
  closeTestDatabase,
  getTestClient,
  resetTestDatabase,
};
