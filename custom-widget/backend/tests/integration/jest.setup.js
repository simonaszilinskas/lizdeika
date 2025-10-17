/**
 * Jest Setup for Integration Tests
 *
 * CRITICAL: This must load test environment variables BEFORE any application code is loaded.
 * The DATABASE_URL must be set before Prisma clients are initialized.
 */

const path = require('path');
const dotenv = require('dotenv');

// Load .env.test file
const result = dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

if (result.error) {
  console.error('Failed to load .env.test:', result.error);
  throw result.error;
}

console.log('[JEST SETUP] Loaded test environment variables');
console.log('[JEST SETUP] NODE_ENV:', process.env.NODE_ENV);

// Increase timeout for integration tests
jest.setTimeout(30000);
