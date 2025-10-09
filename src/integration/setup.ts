/**
 * Integration test setup
 * Additional setup for integration tests beyond the main setupTests.ts
 */

import { TextEncoder, TextDecoder } from 'util';

// Polyfills for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Mock window.location for routing tests
delete (window as any).location;
(window as any).location = {
  href: 'http://localhost:3000',
  origin: 'http://localhost:3000',
  protocol: 'http:',
  host: 'localhost:3000',
  hostname: 'localhost',
  port: '3000',
  pathname: '/',
  search: '',
  hash: '',
  assign: jest.fn(),
  replace: jest.fn(),
  reload: jest.fn()
};

// Mock window.history for navigation tests
(window as any).history = {
  length: 1,
  state: null,
  pushState: jest.fn(),
  replaceState: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  go: jest.fn()
};

// Mock localStorage and sessionStorage
const createStorageMock = () => {
  let store: Record<string, string> = {};
  
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => Object.keys(store)[index] || null)
  };
};

(window as any).localStorage = createStorageMock();
(window as any).sessionStorage = createStorageMock();

// Mock crypto for PKCE and security functions
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: jest.fn((arr: any) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
    randomUUID: jest.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9)),
    subtle: {
      digest: jest.fn(async (algorithm: string, data: ArrayBuffer) => {
        // Mock SHA-256 digest
        return new ArrayBuffer(32);
      })
    }
  },
  writable: true
});

// Mock fetch for network tests
global.fetch = jest.fn();

// Mock ResizeObserver for component tests
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// Mock IntersectionObserver for component tests
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// Suppress console warnings in tests unless explicitly testing error handling
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  // Reset mocks before each test
  jest.clearAllMocks();
  
  // Reset storage mocks
  (window.localStorage as any).clear();
  (window.sessionStorage as any).clear();
  
  // Reset location mock
  Object.assign(window.location, {
    href: 'http://localhost:3000',
    pathname: '/',
    search: '',
    hash: ''
  });
  
  // Suppress console output unless testing error scenarios
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  // Restore console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Global test utilities
export const integrationTestUtils = {
  // Utility to wait for async operations
  waitForAsync: (ms: number = 100) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Utility to simulate user interactions with delays
  simulateUserDelay: (ms: number = 50) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Utility to create mock user data
  createMockUser: (overrides: any = {}) => ({
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    provider: 'azure',
    attributes: {
      domain: 'example.com',
      roles: ['user'],
      department: 'Engineering'
    },
    permissions: [
      {
        resource: 'workflow',
        actions: ['read', 'execute'],
        conditions: []
      }
    ],
    ...overrides
  }),
  
  // Utility to create mock session data
  createMockSession: (user: any) => ({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresAt: Date.now() + 3600000,
    user
  }),
  
  // Utility to mock successful API responses
  mockSuccessfulApiResponse: (data: any) => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
  },
  
  // Utility to mock API errors
  mockApiError: (status: number, message: string) => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: message }), {
        status,
        headers: { 'Content-Type': 'application/json' }
      })
    );
  }
};