
// Jest setup file
import { TextEncoder, TextDecoder } from 'util';

// Polyfills for jsdom
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock WebSocket
global.WebSocket = class WebSocket {
    constructor(url) {
        this.url = url;
        this.readyState = 1; // OPEN
        setTimeout(() => {
            if (this.onopen) this.onopen();
        }, 0);
    }
    
    send(data) {
        // Mock send
    }
    
    close() {
        this.readyState = 3; // CLOSED
        if (this.onclose) this.onclose();
    }
    
    addEventListener(event, handler) {
        this[`on${event}`] = handler;
    }
};

// Mock fetch
global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve('')
    })
);

// Mock localStorage
const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
global.sessionStorage = localStorageMock;

// Mock console methods for cleaner test output
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};

// Suppress error handler console output during tests
process.env.NODE_ENV = 'test';
