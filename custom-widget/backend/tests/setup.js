// Global test setup
require('dotenv').config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Mock Prisma Client globally
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      user: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        upsert: jest.fn(),
      },
      ticket: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      message: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      agent_status: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      $disconnect: jest.fn(),
    })),
  };
});

// Mock console methods to reduce noise during testing
// Comment out these lines if you need to see console output during debugging
global.console = {
  ...console,
  // Suppress info and debug logs during tests
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  // Keep error and warn for debugging
  warn: console.warn,
  error: console.error,
};

// Global test utilities
global.testUtils = {
  // Generate test IDs
  generateTestId: () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  
  // Wait utility for async operations
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Common test data
  testAgent: {
    id: 'test-agent-123',
    name: 'Test Agent',
    status: 'online',
    personalStatus: 'online',
    socketId: 'test-socket-123'
  },
  
  testConversation: {
    id: 'test-conversation-123',
    visitorId: 'test-visitor-123',
    startedAt: new Date().toISOString()
  },
  
  testMessage: {
    content: 'Hello, I need help with school registration',
    sender: 'visitor',
    timestamp: new Date().toISOString()
  }
};

// Global setup
beforeAll(async () => {
  // Add any global setup here
});

// Global teardown
afterAll(async () => {
  // Add any global cleanup here
});