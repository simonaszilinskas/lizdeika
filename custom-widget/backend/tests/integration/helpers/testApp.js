/**
 * Test Express App
 *
 * Uses the real createApp factory to get full application
 * without starting the HTTP server (no server.listen()).
 */

const createApp = require('../../../src/app');

/**
 * Create Express app for testing (without server.listen())
 * Returns the full application with all routes and middleware
 */
function createTestApp() {
  // Load test environment variables
  require('dotenv').config({ path: '.env.test' });

  // Use the real app factory - returns { app, server, io, websocketService }
  const { app } = createApp();

  return app;
}

module.exports = { createTestApp };
