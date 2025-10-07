/**
 * Tests for security service components
 */

import { 
  CSRFProtection, 
  InputValidator, 
  RateLimiter, 
  SecurityHeaders,
  SecureFetch,
  initializeSecurity 
} from '../securityService';

// Mock crypto for testing
const mockCrypto = {
  getRandomValues: jest.fn((array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }),
  subtle: {
    digest: jest.fn(() => Promise.resolve(new ArrayBuffer(32))),
  },
};

Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
});

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(global, 'sessionStorage', {
  value: mockSessionStorage,
});

// Mock fetch
global.fetch = jest.fn();

describe('CSRFProtection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionStorage.getItem.mockReturnValue(null);
  });

  describe('generateCSRFToken', () => {
    it('should generate a CSRF token and store it', () => {
      const token = CSRFProtection.generateCSRFToken();
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes * 2 hex chars
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('csrf_token', token);
    });
  });

  describe('validateCSRFToken', () => {
    it('should validate matching tokens', () => {
      const token = 'test-token';
      mockSessionStorage.getItem.mockReturnValue(token);
      
      const isValid = CSRFProtection.validateCSRFToken(token);
      expect(isValid).toBe(true);
    });

    it('should reject non-matching tokens', () => {
      mockSessionStorage.getItem.mockReturnValue('stored-token');
      
      const isValid = CSRFProtection.validateCSRFToken('different-token');
      expect(isValid).toBe(false);
    });

    it('should reject when no stored token', () => {
      mockSessionStorage.getItem.mockReturnValue(null);
      
      const isValid = CSRFProtection.validateCSRFToken('any-token');
      expect(isValid).toBe(false);
    });
  });

  describe('generateSecureOAuthState', () => {
    it('should generate secure OAuth state with CSRF protection', () => {
      const state = CSRFProtection.generateSecureOAuthState('azure');
      
      expect(state).toBeDefined();
      expect(typeof state).toBe('string');
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('oauth_state_azure', state);
    });
  });

  describe('validateOAuthState', () => {
    it('should validate OAuth state with proper structure', () => {
      const stateData = {
        csrf: 'csrf-token',
        timestamp: Date.now().toString(),
        provider: 'azure',
        nonce: 'test-nonce',
      };
      const state = btoa(JSON.stringify(stateData));
      
      mockSessionStorage.getItem.mockImplementation((key) => {
        if (key === 'oauth_state_azure') return state;
        if (key === 'csrf_token') return 'csrf-token';
        return null;
      });
      
      const isValid = CSRFProtection.validateOAuthState(state, 'azure');
      expect(isValid).toBe(true);
    });

    it('should reject expired OAuth state', () => {
      const stateData = {
        csrf: 'csrf-token',
        timestamp: (Date.now() - 15 * 60 * 1000).toString(), // 15 minutes ago
        provider: 'azure',
        nonce: 'test-nonce',
      };
      const state = btoa(JSON.stringify(stateData));
      
      mockSessionStorage.getItem.mockReturnValue(state);
      
      const isValid = CSRFProtection.validateOAuthState(state, 'azure');
      expect(isValid).toBe(false);
    });
  });
});

describe('InputValidator', () => {
  describe('sanitizeHTML', () => {
    it('should escape HTML entities', () => {
      const input = '<script>alert("xss")</script>';
      const sanitized = InputValidator.sanitizeHTML(input);
      
      expect(sanitized).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      expect(InputValidator.validateEmail('user@example.com')).toBe(true);
      expect(InputValidator.validateEmail('test.email+tag@domain.co.uk')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(InputValidator.validateEmail('invalid-email')).toBe(false);
      expect(InputValidator.validateEmail('user@')).toBe(false);
      expect(InputValidator.validateEmail('@domain.com')).toBe(false);
    });

    it('should reject overly long emails', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      expect(InputValidator.validateEmail(longEmail)).toBe(false);
    });
  });

  describe('validateWorkflowInput', () => {
    it('should validate clean input objects', () => {
      const input = {
        name: 'test',
        value: 123,
        nested: {
          property: 'value',
        },
      };
      
      const result = InputValidator.validateWorkflowInput(input);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject dangerous property names', () => {
      const input = {
        __proto__: 'dangerous',
        constructor: 'bad',
        prototype: 'evil',
      };
      
      const result = InputValidator.validateWorkflowInput(input);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(err => err.includes('Dangerous property name not allowed'))).toBe(true);
    });

    it('should reject invalid property name formats', () => {
      const input = {
        'invalid-name': 'value',
        '123invalid': 'value',
      };
      
      const result = InputValidator.validateWorkflowInput(input);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject overly long string values', () => {
      const input = {
        longString: 'a'.repeat(15000),
      };
      
      const result = InputValidator.validateWorkflowInput(input);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('String value too long');
    });

    it('should detect script injection attempts', () => {
      const input = {
        malicious: '<script>alert("xss")</script>',
        onclick: 'onclick="alert(1)"',
      };
      
      const result = InputValidator.validateWorkflowInput(input);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(err => err.includes('dangerous content'))).toBe(true);
    });
  });

  describe('validateURL', () => {
    it('should validate HTTPS URLs', () => {
      expect(InputValidator.validateURL('https://example.com')).toBe(true);
      expect(InputValidator.validateURL('https://api.example.com/path')).toBe(true);
    });

    it('should validate HTTP URLs', () => {
      expect(InputValidator.validateURL('http://example.com')).toBe(true);
    });

    it('should reject non-HTTP protocols', () => {
      expect(InputValidator.validateURL('ftp://example.com')).toBe(false);
      expect(InputValidator.validateURL('javascript:alert(1)')).toBe(false);
      expect(InputValidator.validateURL('data:text/html,<script>alert(1)</script>')).toBe(false);
    });

    it('should reject invalid URLs', () => {
      expect(InputValidator.validateURL('not-a-url')).toBe(false);
      expect(InputValidator.validateURL('http://')).toBe(false);
    });
  });

  describe('validateJSON', () => {
    it('should validate correct JSON', () => {
      const json = '{"name": "test", "value": 123}';
      const result = InputValidator.validateJSON(json);
      
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual({ name: 'test', value: 123 });
    });

    it('should reject invalid JSON', () => {
      const json = '{"name": "test", "value":}';
      const result = InputValidator.validateJSON(json);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject overly large JSON', () => {
      const largeJson = '{"data": "' + 'a'.repeat(150000) + '"}';
      const result = InputValidator.validateJSON(largeJson);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too large');
    });
  });
});

describe('RateLimiter', () => {
  beforeEach(() => {
    RateLimiter.clearAll();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('isAllowed', () => {
    it('should allow requests within limits', () => {
      expect(RateLimiter.isAllowed('test-key', 5, 60000)).toBe(true);
      expect(RateLimiter.isAllowed('test-key', 5, 60000)).toBe(true);
      expect(RateLimiter.isAllowed('test-key', 5, 60000)).toBe(true);
    });

    it('should reject requests exceeding limits', () => {
      // Fill up the limit
      for (let i = 0; i < 5; i++) {
        expect(RateLimiter.isAllowed('test-key', 5, 60000)).toBe(true);
      }
      
      // Next request should be rejected
      expect(RateLimiter.isAllowed('test-key', 5, 60000)).toBe(false);
    });

    it('should handle different keys independently', () => {
      // Fill up limit for key1
      for (let i = 0; i < 5; i++) {
        expect(RateLimiter.isAllowed('key1', 5, 60000)).toBe(true);
      }
      
      // key2 should still be allowed
      expect(RateLimiter.isAllowed('key2', 5, 60000)).toBe(true);
    });
  });

  describe('getRemainingRequests', () => {
    it('should return correct remaining count', () => {
      expect(RateLimiter.getRemainingRequests('test-key', 5, 60000)).toBe(5);
      
      RateLimiter.isAllowed('test-key', 5, 60000);
      expect(RateLimiter.getRemainingRequests('test-key', 5, 60000)).toBe(4);
      
      RateLimiter.isAllowed('test-key', 5, 60000);
      expect(RateLimiter.getRemainingRequests('test-key', 5, 60000)).toBe(3);
    });
  });

  describe('cleanup', () => {
    it('should remove old entries', () => {
      RateLimiter.isAllowed('test-key', 5, 1000); // 1 second window
      
      // Simulate time passing
      jest.advanceTimersByTime(2000);
      
      RateLimiter.cleanup(1000);
      
      // Should be able to make requests again
      expect(RateLimiter.getRemainingRequests('test-key', 5, 1000)).toBe(5);
    });
  });
});

describe('SecurityHeaders', () => {
  describe('generateCSP', () => {
    it('should generate CSP string', () => {
      const csp = SecurityHeaders.generateCSP();
      
      expect(csp).toBeDefined();
      expect(typeof csp).toBe('string');
      expect(csp).toContain("default-src 'self'");
    });
  });

  describe('getSecurityHeaders', () => {
    it('should return security headers object', () => {
      const headers = SecurityHeaders.getSecurityHeaders();
      
      expect(headers).toBeDefined();
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-Frame-Options']).toBeDefined();
    });
  });
});

describe('SecureFetch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
      headers: {
        get: jest.fn((name: string) => {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-Content-Type-Options': 'nosniff',
          };
          return headers[name] || null;
        }),
      },
    });
  });

  describe('fetch', () => {
    it('should make secure requests with proper headers', async () => {
      await SecureFetch.fetch('https://api.example.com/test');
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Content-Type-Options': 'nosniff',
            'Content-Type': 'application/json',
          }),
          credentials: 'same-origin',
          mode: 'cors',
        })
      );
    });

    it('should reject invalid URLs', async () => {
      await expect(SecureFetch.fetch('javascript:alert(1)')).rejects.toThrow('Invalid or unsafe URL');
    });

    it('should apply rate limiting when key provided', async () => {
      // Fill up rate limit
      for (let i = 0; i < 100; i++) {
        await SecureFetch.fetch('https://api.example.com/test', {}, 'test-endpoint');
      }
      
      // Next request should be rate limited
      await expect(
        SecureFetch.fetch('https://api.example.com/test', {}, 'test-endpoint')
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should validate JSON request bodies', async () => {
      const invalidJson = '{"invalid": json}';
      
      await expect(
        SecureFetch.fetch('https://api.example.com/test', {
          method: 'POST',
          body: invalidJson,
        })
      ).rejects.toThrow('Invalid request body');
    });
  });
});

describe('initializeSecurity', () => {
  let originalDocument: any;
  let originalWindow: any;

  beforeAll(() => {
    originalDocument = global.document;
    originalWindow = global.window;
  });

  afterAll(() => {
    global.document = originalDocument;
    global.window = originalWindow;
  });

  beforeEach(() => {
    // Mock document methods
    const mockDocument = {
      createElement: jest.fn(() => ({
        setAttribute: jest.fn(),
        remove: jest.fn(),
        httpEquiv: '',
        content: '',
      })),
      querySelector: jest.fn(() => null),
      head: {
        appendChild: jest.fn(),
      },
    };

    // Mock window methods
    const mockWindow = {
      addEventListener: jest.fn(),
    };

    // Mock console.warn to suppress warnings in tests
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    (global as any).document = mockDocument;
    (global as any).window = mockWindow;
  });

  it('should initialize security features', () => {
    const mockDocument = global.document as any;
    const mockWindow = global.window as any;
    
    initializeSecurity();
    
    expect(mockDocument.createElement).toHaveBeenCalled();
    expect(mockWindow.addEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });
});