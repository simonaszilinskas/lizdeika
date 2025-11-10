/**
 * Test Express App
 *
 * Uses the real createApp factory to get full application
 * without starting the HTTP server (no server.listen()).
 *
 * IMPORTANT: .env.test must be loaded at module load time (top-level),
 * not inside a function, because modules like tokenUtils initialize
 * their config when they are first required.
 */

// Load test environment variables FIRST, before any other imports
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env.test') });

const createApp = require('../../../src/app');

/**
 * Create Express app for testing (without server.listen())
 * Returns object with app and websocketService for proper cleanup
 */
function createTestApp() {
  // Use the real app factory - returns { app, server, io, websocketService }
  const { app, websocketService } = createApp();

  return { app, websocketService };
}

module.exports = { createTestApp };
