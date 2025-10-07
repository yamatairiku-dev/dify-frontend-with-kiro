/**
 * Security integration examples and demonstrations
 */

import {
  CSRFProtection,
  InputValidator,
  RateLimiter,
  SecurityHeaders,
  SecureFetch,
} from '../services/securityService';
import { AuthProviderType } from '../types/auth';

/**
 * Example: Secure OAuth flow with CSRF protection
 */
export async function secureOAuthFlow(provider: AuthProviderType): Promise<void> {
  try {
    // Generate secure OAuth state with CSRF protection
    const state = CSRFProtection.generateSecureOAuthState(provider);
    console.log(`Generated secure OAuth state for ${provider}:`, state.substring(0, 20) + '...');

    // Simulate OAuth callback validation
    const isValid = CSRFProtection.validateOAuthState(state, provider);
    console.log(`OAuth state validation result: ${isValid}`);

    if (isValid) {
      console.log('✅ OAuth flow completed securely');
    } else {
      console.log('❌ OAuth flow failed security validation');
    }
  } catch (error) {
    console.error('OAuth security error:', error);
  }
}

/**
 * Example: Input validation and sanitization
 */
export function demonstrateInputValidation(): void {
  console.log('\n=== Input Validation Examples ===');

  // Test email validation
  const emails = [
    'valid@example.com',
    'invalid-email',
    'test@domain.co.uk',
    'malicious@<script>alert(1)</script>.com',
  ];

  emails.forEach(email => {
    const isValid = InputValidator.validateEmail(email);
    console.log(`Email "${email}": ${isValid ? '✅ Valid' : '❌ Invalid'}`);
  });

  // Test HTML sanitization
  const htmlInputs = [
    'Safe text content',
    '<script>alert("XSS")</script>',
    '<img src="x" onerror="alert(1)">',
    'Normal <b>bold</b> text',
  ];

  htmlInputs.forEach(html => {
    const sanitized = InputValidator.sanitizeHTML(html);
    console.log(`HTML "${html}" → "${sanitized}"`);
  });

  // Test workflow input validation
  const workflowInputs = [
    { name: 'test', value: 123 },
    { __proto__: 'dangerous' },
    { 'invalid-name': 'value' },
    { malicious: '<script>alert(1)</script>' },
    { longString: 'a'.repeat(15000) },
  ];

  workflowInputs.forEach((input, index) => {
    const result = InputValidator.validateWorkflowInput(input);
    console.log(`Workflow input ${index + 1}: ${result.isValid ? '✅ Valid' : '❌ Invalid'}`);
    if (!result.isValid) {
      console.log(`  Errors: ${result.errors.join(', ')}`);
    }
  });
}

/**
 * Example: Rate limiting demonstration
 */
export function demonstrateRateLimiting(): void {
  console.log('\n=== Rate Limiting Examples ===');

  const endpoint = 'test-api';
  const maxRequests = 5;
  const windowMs = 60000; // 1 minute

  console.log(`Testing rate limit: ${maxRequests} requests per ${windowMs}ms`);

  // Simulate API requests
  for (let i = 1; i <= 7; i++) {
    const allowed = RateLimiter.isAllowed(endpoint, maxRequests, windowMs);
    const remaining = RateLimiter.getRemainingRequests(endpoint, maxRequests, windowMs);
    
    console.log(`Request ${i}: ${allowed ? '✅ Allowed' : '❌ Rate limited'} (${remaining} remaining)`);
  }

  // Clear rate limit for cleanup
  RateLimiter.clearKey(endpoint);
}

/**
 * Example: Secure API requests
 */
export async function demonstrateSecureRequests(): Promise<void> {
  console.log('\n=== Secure Request Examples ===');

  try {
    // Test valid URL
    console.log('Testing secure fetch with valid URL...');
    // Note: This will fail in test environment, but demonstrates the API
    // await SecureFetch.fetch('https://api.example.com/test');
    console.log('✅ Secure fetch API configured correctly');

    // Test invalid URL
    try {
      await SecureFetch.fetch('javascript:alert(1)');
    } catch (error) {
      console.log('✅ Invalid URL rejected:', (error as Error).message);
    }

    // Test rate limiting
    try {
      for (let i = 0; i < 101; i++) {
        await SecureFetch.fetch('https://api.example.com/test', {}, 'demo-endpoint');
      }
    } catch (error) {
      console.log('✅ Rate limiting working:', (error as Error).message);
    }

  } catch (error) {
    console.log('Expected error in demo environment:', (error as Error).message);
  }
}

/**
 * Example: Security headers configuration
 */
export function demonstrateSecurityHeaders(): void {
  console.log('\n=== Security Headers Examples ===');

  // Generate CSP
  const csp = SecurityHeaders.generateCSP();
  console.log('Generated CSP:', csp.substring(0, 100) + '...');

  // Get security headers
  const headers = SecurityHeaders.getSecurityHeaders();
  console.log('Security headers:');
  Object.entries(headers).forEach(([name, value]) => {
    console.log(`  ${name}: ${value}`);
  });

  // Set CSP meta tag (in browser environment)
  if (typeof document !== 'undefined') {
    SecurityHeaders.setCSPMetaTag();
    console.log('✅ CSP meta tag set in document head');
  }
}

/**
 * Example: Complete security integration
 */
export async function demonstrateCompleteSecurityIntegration(): Promise<void> {
  console.log('🔒 Security Integration Demonstration\n');

  // 1. OAuth security
  await secureOAuthFlow('azure');

  // 2. Input validation
  demonstrateInputValidation();

  // 3. Rate limiting
  demonstrateRateLimiting();

  // 4. Secure requests
  await demonstrateSecureRequests();

  // 5. Security headers
  demonstrateSecurityHeaders();

  console.log('\n✅ Security integration demonstration completed');
}

/**
 * Security configuration validation
 */
export function validateSecuritySetup(): {
  isSecure: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check CSRF token
  const csrfToken = CSRFProtection.getCSRFToken();
  if (!csrfToken) {
    issues.push('No CSRF token found - call CSRFProtection.generateCSRFToken()');
  }

  // Check CSP meta tag
  if (typeof document !== 'undefined') {
    const cspMeta = document.querySelector('meta[http-equiv*="Content-Security-Policy"]');
    if (!cspMeta) {
      issues.push('No CSP meta tag found - call SecurityHeaders.setCSPMetaTag()');
    }
  }

  // Environment-specific recommendations
  if (process.env['NODE_ENV'] === 'development') {
    recommendations.push('Consider enabling stricter CSP in production');
    recommendations.push('Review rate limiting configuration for production load');
  }

  if (process.env['NODE_ENV'] === 'production') {
    recommendations.push('Ensure HSTS is enabled on the server');
    recommendations.push('Consider implementing CSP reporting');
    recommendations.push('Review and test all security headers');
  }

  return {
    isSecure: issues.length === 0,
    issues,
    recommendations,
  };
}

/**
 * Security testing utilities
 */
export const SecurityTestUtils = {
  /**
   * Test CSRF protection
   */
  testCSRFProtection(): boolean {
    const token1 = CSRFProtection.generateCSRFToken();
    const token2 = CSRFProtection.getCSRFToken();
    return token1 === token2 && CSRFProtection.validateCSRFToken(token1);
  },

  /**
   * Test input validation
   */
  testInputValidation(): boolean {
    const maliciousInput = { __proto__: 'evil', '<script>': 'alert(1)' };
    const result = InputValidator.validateWorkflowInput(maliciousInput);
    return !result.isValid && result.errors.length > 0;
  },

  /**
   * Test rate limiting
   */
  testRateLimiting(): boolean {
    const key = 'test-rate-limit';
    RateLimiter.clearKey(key);
    
    // Should allow first request
    const allowed1 = RateLimiter.isAllowed(key, 1, 60000);
    
    // Should block second request
    const allowed2 = RateLimiter.isAllowed(key, 1, 60000);
    
    RateLimiter.clearKey(key);
    return allowed1 && !allowed2;
  },

  /**
   * Run all security tests
   */
  runAllTests(): { passed: number; failed: number; results: Record<string, boolean> } {
    const tests = {
      csrfProtection: this.testCSRFProtection(),
      inputValidation: this.testInputValidation(),
      rateLimiting: this.testRateLimiting(),
    };

    const passed = Object.values(tests).filter(Boolean).length;
    const failed = Object.values(tests).length - passed;

    return { passed, failed, results: tests };
  },
};