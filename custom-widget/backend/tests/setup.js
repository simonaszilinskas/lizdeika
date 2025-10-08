// Global test setup
require('dotenv').config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Create shared mock Prisma instance
const mockPrismaInstance = {
  users: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    upsert: jest.fn(),
    count: jest.fn(),
  },
  user_activities: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  refresh_tokens: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  tickets: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  messages: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  ticket_actions: {
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  agent_status: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
  system_logs: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  response_templates: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  categories: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  $disconnect: jest.fn(),
  $transaction: jest.fn(),
  $connect: jest.fn(),
  $queryRaw: jest.fn(),
};

// Mock Prisma Client globally
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => mockPrismaInstance),
  };
});

// Mock database client to return the same mock instance
jest.mock('../src/utils/database', () => ({
  connect: jest.fn().mockResolvedValue(mockPrismaInstance),
  getClient: jest.fn(() => mockPrismaInstance),
  disconnect: jest.fn().mockResolvedValue(undefined),
  healthCheck: jest.fn().mockResolvedValue({ status: 'healthy', timestamp: new Date() }),
  prisma: mockPrismaInstance,
}));

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
  generateUuid: () => require('crypto').randomUUID(),
  
  // Wait utility for async operations
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Common test data
  testUser: {
    id: 'cmek0xf7i001f11ij4td3s33l',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    role: 'user',
    is_active: true,
    email_verified: true,
    password_hash: '$2b$12$test.hash.value',
    created_at: new Date('2025-01-01T00:00:00Z'),
    updated_at: new Date('2025-01-01T00:00:00Z'),
  },

  testAdmin: {
    id: 'admin-test-id',
    email: 'admin@example.com',
    first_name: 'Admin',
    last_name: 'User',
    role: 'admin',
    is_active: true,
    email_verified: true,
    password_hash: '$2b$12$admin.hash.value',
    created_at: new Date('2025-01-01T00:00:00Z'),
    updated_at: new Date('2025-01-01T00:00:00Z'),
  },

  testActivity: {
    id: 'activity-test-id',
    user_id: 'cmek0xf7i001f11ij4td3s33l',
    action_type: 'auth',
    action: 'login_success',
    resource: null,
    resource_id: null,
    ip_address: '192.168.1.1',
    user_agent: 'Jest Test Agent',
    details: { role: 'user' },
    success: true,
    created_at: new Date('2025-01-01T00:00:00Z'),
  },
  
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
  },

  // Mock Express request object
  mockRequest: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ip: '127.0.0.1',
    ...overrides,
  }),

  // Mock Express response object
  mockResponse: () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res;
  },

  // Generate mock JWT token
  mockJwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token',

  // Mock bcrypt hash
  mockHashedPassword: '$2b$12$mock.hashed.password.value',
};

// Global setup
beforeAll(async () => {
  // Add any global setup here
});

// Global teardown
afterAll(async () => {
  // Add any global cleanup here
});