/**
 * Jest setup file for frontend tests
 * Provides common mocks and utilities for testing browser-based JavaScript
 */

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
};

// Mock WebSocket
global.WebSocket = jest.fn(() => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1
}));

// Mock socket.io
const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  connected: true,
  to: jest.fn().mockReturnThis()
};

global.io = jest.fn(() => mockSocket);

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};
global.localStorage = localStorageMock;

// Mock sessionStorage
global.sessionStorage = { ...localStorageMock };

// Mock URL constructor
global.URL = jest.fn(() => ({
  toString: () => 'http://localhost:3002'
}));

// Mock setTimeout and setInterval for async testing
global.setTimeout = jest.fn((cb) => cb());
global.setInterval = jest.fn((cb) => cb());
global.clearTimeout = jest.fn();
global.clearInterval = jest.fn();

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  
  // Reset console mocks
  console.log.mockClear();
  console.warn.mockClear();
  console.error.mockClear();
  console.info.mockClear();
  
  // Reset localStorage mocks
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
});