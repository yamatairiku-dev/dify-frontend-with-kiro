/**
 * Tests for security configuration
 */

import {
  getSecurityConfig,
  generateCSPString,
  getSecurityHeaders,
  validateSecurityConfig,
  defaultSecurityConfig,
} from '../security';

// Mock environment variables
const originalEnv = process.env;

describe('Security Configuration', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getSecurityConfig', () => {
    it('should return development configuration', () => {
      process.env['NODE_ENV'] = 'development';
      
      const config = getSecurityConfig();
      
      expect(config.csp.reportOnly).toBe(true);
      expect(config.csp.directives['script-src']).toContain("'unsafe-eval'");
      expect(config.csp.directives['connect-src']).toContain('ws:');
      expect(config.headers.hsts).toBe(false);
    });

    it('should return production configuration', () => {
      process.env['NODE_ENV'] = 'production';
      
      const config = getSecurityConfig();
      
      expect(config.csp.reportOnly).toBe(false);
      expect(config.csp.directives['script-src']).not.toContain("'unsafe-eval'");
      expect(config.csp.directives['connect-src']).not.toContain('ws:');
      expect(config.headers.hsts).toBe(true);
    });

    it('should include OAuth provider URLs in connect-src', () => {
      const config = getSecurityConfig();
      
      expect(config.csp.directives['connect-src']).toContain('https://login.microsoftonline.com');
      expect(config.csp.directives['connect-src']).toContain('https://github.com');
      expect(config.csp.directives['connect-src']).toContain('https://accounts.google.com');
    });

    it('should include API URLs from environment variables', () => {
      process.env['VITE_API_BASE_URL'] = 'https://api.custom.com';
      process.env['VITE_DIFY_API_URL'] = 'https://dify.custom.com';
      
      const config = getSecurityConfig();
      
      expect(config.csp.directives['connect-src']).toContain('https://api.custom.com');
      expect(config.csp.directives['connect-src']).toContain('https://dify.custom.com');
    });
  });

  describe('generateCSPString', () => {
    it('should generate valid CSP string', () => {
      const config = getSecurityConfig();
      const cspString = generateCSPString(config);
      
      expect(cspString).toBeDefined();
      expect(typeof cspString).toBe('string');
      expect(cspString).toContain("default-src 'self'");
      expect(cspString).toContain("frame-ancestors 'none'");
    });

    it('should handle undefined directives', () => {
      const config = {
        ...getSecurityConfig(),
        csp: {
          ...getSecurityConfig().csp,
          directives: {
            'default-src': ["'self'"],
            'script-src': undefined as any,
          },
        },
      };
      
      const cspString = generateCSPString(config);
      
      expect(cspString).toBe("default-src 'self'");
    });
  });

  describe('getSecurityHeaders', () => {
    it('should return all security headers for production', () => {
      process.env['NODE_ENV'] = 'production';
      const config = getSecurityConfig();
      const headers = getSecurityHeaders(config);
      
      expect(headers['Strict-Transport-Security']).toBeDefined();
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['X-XSS-Protection']).toBe('1; mode=block');
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
      expect(headers['Permissions-Policy']).toBeDefined();
      expect(headers['Content-Security-Policy']).toBeDefined();
    });

    it('should not include HSTS in development', () => {
      process.env['NODE_ENV'] = 'development';
      const config = getSecurityConfig();
      const headers = getSecurityHeaders(config);
      
      expect(headers['Strict-Transport-Security']).toBeUndefined();
    });

    it('should use report-only CSP in development', () => {
      process.env['NODE_ENV'] = 'development';
      const config = getSecurityConfig();
      const headers = getSecurityHeaders(config);
      
      expect(headers['Content-Security-Policy-Report-Only']).toBeDefined();
      expect(headers['Content-Security-Policy']).toBeUndefined();
    });
  });

  describe('validateSecurityConfig', () => {
    it('should validate correct configuration', () => {
      const config = getSecurityConfig();
      const validation = validateSecurityConfig(config);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing required CSP directives', () => {
      const config = {
        ...getSecurityConfig(),
        csp: {
          ...getSecurityConfig().csp,
          directives: {
            'style-src': ["'self'"],
            // Missing default-src and script-src
          },
        },
      };
      
      const validation = validateSecurityConfig(config);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Missing required CSP directive: default-src');
      expect(validation.errors).toContain('Missing required CSP directive: script-src');
    });

    it('should detect unsafe directives in production', () => {
      process.env['NODE_ENV'] = 'production';
      
      const config = {
        ...getSecurityConfig(),
        csp: {
          ...getSecurityConfig().csp,
          directives: {
            'default-src': ["'self'"],
            'script-src': ["'self'", "'unsafe-eval'"],
            'style-src': ["'self'", "'unsafe-inline'"],
          },
        },
      };
      
      const validation = validateSecurityConfig(config);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(err => err.includes('unsafe-eval'))).toBe(true);
      expect(validation.errors.some(err => err.includes('unsafe-inline'))).toBe(true);
    });

    it('should validate rate limiting configuration', () => {
      const config = {
        ...getSecurityConfig(),
        rateLimiting: {
          ...getSecurityConfig().rateLimiting,
          maxRequests: 0,
          windowMs: -1000,
        },
      };
      
      const validation = validateSecurityConfig(config);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Rate limiting maxRequests must be greater than 0');
      expect(validation.errors).toContain('Rate limiting windowMs must be greater than 0');
    });

    it('should validate input validation configuration', () => {
      const config = {
        ...getSecurityConfig(),
        inputValidation: {
          ...getSecurityConfig().inputValidation,
          maxInputLength: 0,
          maxJsonSize: -1000,
        },
      };
      
      const validation = validateSecurityConfig(config);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Input validation maxInputLength must be greater than 0');
      expect(validation.errors).toContain('Input validation maxJsonSize must be greater than 0');
    });
  });

  describe('defaultSecurityConfig', () => {
    it('should be valid', () => {
      const validation = validateSecurityConfig(defaultSecurityConfig);
      
      expect(validation.isValid).toBe(true);
    });

    it('should have all required properties', () => {
      expect(defaultSecurityConfig.csp).toBeDefined();
      expect(defaultSecurityConfig.rateLimiting).toBeDefined();
      expect(defaultSecurityConfig.csrf).toBeDefined();
      expect(defaultSecurityConfig.inputValidation).toBeDefined();
      expect(defaultSecurityConfig.headers).toBeDefined();
    });

    it('should have proper rate limiting endpoints', () => {
      expect(defaultSecurityConfig.rateLimiting.endpoints).toBeDefined();
      expect(defaultSecurityConfig.rateLimiting.endpoints['/api/auth/oauth/exchange']).toBeDefined();
      expect(defaultSecurityConfig.rateLimiting.endpoints['/api/v1/workflows']).toBeDefined();
    });
  });

  describe('Environment-specific configurations', () => {
    it('should allow unsafe directives in development', () => {
      process.env['NODE_ENV'] = 'development';
      
      const config = getSecurityConfig();
      
      expect(config.csp.directives['script-src']).toContain("'unsafe-eval'");
      expect(config.csp.directives['script-src']).toContain("'unsafe-inline'");
    });

    it('should not allow unsafe directives in production', () => {
      process.env['NODE_ENV'] = 'production';
      
      const config = getSecurityConfig();
      
      expect(config.csp.directives['script-src']).not.toContain("'unsafe-eval'");
      expect(config.csp.directives['script-src']).not.toContain("'unsafe-inline'");
    });

    it('should include upgrade-insecure-requests in production', () => {
      process.env['NODE_ENV'] = 'production';
      
      const config = getSecurityConfig();
      
      expect(config.csp.directives['upgrade-insecure-requests']).toEqual([]);
    });

    it('should not include upgrade-insecure-requests in development', () => {
      process.env['NODE_ENV'] = 'development';
      
      const config = getSecurityConfig();
      
      expect(config.csp.directives['upgrade-insecure-requests']).toBeUndefined();
    });
  });
});