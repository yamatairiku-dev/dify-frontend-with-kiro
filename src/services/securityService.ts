/**
 * Client-side security service for CSRF protection, input validation, and rate limiting
 */

import { AuthProviderType } from '../types/auth';
import { getSecurityConfig, generateCSPString, getSecurityHeaders } from '../config/security';

/**
 * CSRF Token Management
 */
export class CSRFProtection {
  private static readonly CSRF_TOKEN_KEY = 'csrf_token';
  private static readonly CSRF_HEADER_NAME = 'X-CSRF-Token';

  /**
   * Generate a cryptographically secure CSRF token
   */
  static generateCSRFToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    
    // Store token in sessionStorage for validation
    sessionStorage.setItem(this.CSRF_TOKEN_KEY, token);
    
    return token;
  }

  /**
   * Get the current CSRF token
   */
  static getCSRFToken(): string | null {
    return sessionStorage.getItem(this.CSRF_TOKEN_KEY);
  }

  /**
   * Validate CSRF token
   */
  static validateCSRFToken(token: string): boolean {
    const storedToken = this.getCSRFToken();
    if (!storedToken || !token) {
      return false;
    }
    
    // Constant-time comparison to prevent timing attacks
    return this.constantTimeEquals(storedToken, token);
  }

  /**
   * Clear CSRF token
   */
  static clearCSRFToken(): void {
    sessionStorage.removeItem(this.CSRF_TOKEN_KEY);
  }

  /**
   * Add CSRF token to request headers
   */
  static addCSRFHeader(headers: Record<string, string> = {}): Record<string, string> {
    const token = this.getCSRFToken();
    if (token) {
      headers[this.CSRF_HEADER_NAME] = token;
    }
    return headers;
  }

  /**
   * Enhanced OAuth state generation with CSRF protection
   */
  static generateSecureOAuthState(provider: AuthProviderType): string {
    const csrfToken = this.generateCSRFToken();
    const timestamp = Date.now().toString();
    const nonce = crypto.getRandomValues(new Uint8Array(16));
    const nonceHex = Array.from(nonce, byte => byte.toString(16).padStart(2, '0')).join('');
    
    // Combine CSRF token, timestamp, provider, and nonce
    const stateData = {
      csrf: csrfToken,
      timestamp,
      provider,
      nonce: nonceHex,
    };
    
    // Encode as base64 for URL safety
    const stateString = btoa(JSON.stringify(stateData));
    
    // Store for validation
    sessionStorage.setItem(`oauth_state_${provider}`, stateString);
    
    return stateString;
  }

  /**
   * Validate OAuth state with CSRF protection
   */
  static validateOAuthState(state: string, provider: AuthProviderType): boolean {
    try {
      const storedState = sessionStorage.getItem(`oauth_state_${provider}`);
      if (!storedState || storedState !== state) {
        return false;
      }

      const stateData = JSON.parse(atob(state));
      
      // Validate structure
      if (!stateData.csrf || !stateData.timestamp || !stateData.provider || !stateData.nonce) {
        return false;
      }

      // Validate provider matches
      if (stateData.provider !== provider) {
        return false;
      }

      // Validate timestamp (max 10 minutes old)
      const maxAge = 10 * 60 * 1000; // 10 minutes
      if (Date.now() - parseInt(stateData.timestamp) > maxAge) {
        return false;
      }

      // Validate CSRF token
      return this.validateCSRFToken(stateData.csrf);
    } catch (error) {
      return false;
    }
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private static constantTimeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}

/**
 * Input Validation and Sanitization
 */
export class InputValidator {
  private static securityConfig = getSecurityConfig();
  /**
   * Sanitize HTML input to prevent XSS
   */
  static sanitizeHTML(input: string): string {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * Validate workflow input
   */
  static validateWorkflowInput(input: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (typeof input !== 'object' || input === null) {
      errors.push('Input must be a valid object');
      return { isValid: false, errors };
    }

    // Check for potentially dangerous properties
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    for (const key of Object.keys(input)) {
      if (dangerousKeys.includes(key)) {
        errors.push(`Dangerous property name not allowed: ${key}`);
      }

      // Validate key format
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        errors.push(`Invalid property name format: ${key}`);
      }
    }

    // Recursively validate nested objects
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string') {
        // Check string length limits
        if (value.length > this.securityConfig.inputValidation.maxInputLength) {
          errors.push(`String value too long for property: ${key} (max: ${this.securityConfig.inputValidation.maxInputLength})`);
        }
        
        // Check for potential script injection
        if (this.containsScriptTags(value)) {
          errors.push(`Potentially dangerous content in property: ${key}`);
        }
      } else if (typeof value === 'object' && value !== null) {
        const nestedValidation = this.validateWorkflowInput(value);
        if (!nestedValidation.isValid) {
          errors.push(...nestedValidation.errors.map(err => `${key}.${err}`));
        }
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Check for script tags or dangerous content
   */
  private static containsScriptTags(input: string): boolean {
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b/gi,
      /<object\b/gi,
      /<embed\b/gi,
    ];

    return dangerousPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Validate URL format and safety
   */
  static validateURL(url: string): boolean {
    try {
      const urlObj = new URL(url);
      
      // Only allow HTTP and HTTPS protocols
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return false;
      }

      // Prevent localhost and private IP ranges in production
      if (process.env['NODE_ENV'] === 'production') {
        const hostname = urlObj.hostname;
        if (
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.startsWith('172.')
        ) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sanitize and validate JSON input
   */
  static validateJSON(jsonString: string): { isValid: boolean; data?: any; error?: string } {
    try {
      // Check string length
      if (jsonString.length > this.securityConfig.inputValidation.maxJsonSize) {
        return { isValid: false, error: `JSON string too large (max: ${this.securityConfig.inputValidation.maxJsonSize})` };
      }

      const data = JSON.parse(jsonString);
      
      // Validate the parsed data
      const validation = this.validateWorkflowInput(data);
      if (!validation.isValid) {
        return { isValid: false, error: validation.errors.join(', ') };
      }

      return { isValid: true, data };
    } catch (error) {
      return { 
        isValid: false, 
        error: error instanceof Error ? error.message : 'Invalid JSON format' 
      };
    }
  }
}

/**
 * Rate Limiting for API Requests
 */
export class RateLimiter {
  private static requests: Map<string, number[]> = new Map();
  private static securityConfig = getSecurityConfig();
  private static readonly DEFAULT_WINDOW_MS = 60000; // 1 minute
  private static readonly DEFAULT_MAX_REQUESTS = 60; // 60 requests per minute

  /**
   * Check if request is allowed based on rate limits
   */
  static isAllowed(
    key: string, 
    maxRequests?: number,
    windowMs?: number
  ): boolean {
    // Use endpoint-specific limits if available
    const endpointConfig = this.securityConfig.rateLimiting.endpoints[key];
    const finalMaxRequests = maxRequests ?? endpointConfig?.maxRequests ?? this.securityConfig.rateLimiting.maxRequests;
    const finalWindowMs = windowMs ?? endpointConfig?.windowMs ?? this.securityConfig.rateLimiting.windowMs;
    const now = Date.now();
    const windowStart = now - finalWindowMs;

    // Get existing requests for this key
    const requests = this.requests.get(key) || [];
    
    // Filter out old requests
    const recentRequests = requests.filter(timestamp => timestamp > windowStart);
    
    // Check if limit exceeded
    if (recentRequests.length >= finalMaxRequests) {
      return false;
    }

    // Add current request
    recentRequests.push(now);
    this.requests.set(key, recentRequests);

    return true;
  }

  /**
   * Get remaining requests for a key
   */
  static getRemainingRequests(
    key: string,
    maxRequests: number = this.DEFAULT_MAX_REQUESTS,
    windowMs: number = this.DEFAULT_WINDOW_MS
  ): number {
    const now = Date.now();
    const windowStart = now - windowMs;
    const requests = this.requests.get(key) || [];
    const recentRequests = requests.filter(timestamp => timestamp > windowStart);
    
    return Math.max(0, maxRequests - recentRequests.length);
  }

  /**
   * Get time until rate limit resets
   */
  static getResetTime(
    key: string,
    windowMs: number = this.DEFAULT_WINDOW_MS
  ): number {
    const requests = this.requests.get(key) || [];
    if (requests.length === 0) {
      return 0;
    }

    const oldestRequest = Math.min(...requests);
    const resetTime = oldestRequest + windowMs;
    
    return Math.max(0, resetTime - Date.now());
  }

  /**
   * Clear rate limit data for a key
   */
  static clearKey(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Clear all rate limit data
   */
  static clearAll(): void {
    this.requests.clear();
  }

  /**
   * Clean up old entries periodically
   */
  static cleanup(windowMs: number = this.DEFAULT_WINDOW_MS): void {
    const now = Date.now();
    const cutoff = now - windowMs;

    for (const [key, requests] of this.requests.entries()) {
      const recentRequests = requests.filter(timestamp => timestamp > cutoff);
      if (recentRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, recentRequests);
      }
    }
  }
}

/**
 * Security Headers and CSP Management
 */
export class SecurityHeaders {
  private static securityConfig = getSecurityConfig();

  /**
   * Generate Content Security Policy from configuration
   */
  static generateCSP(): string {
    return generateCSPString(this.securityConfig);
  }

  /**
   * Apply security headers to fetch requests
   */
  static getSecurityHeaders(): Record<string, string> {
    return getSecurityHeaders(this.securityConfig);
  }

  /**
   * Set CSP meta tag in document head
   */
  static setCSPMetaTag(): void {
    if (!this.securityConfig.csp.enabled) {
      return;
    }

    const existingMeta = document.querySelector('meta[http-equiv*="Content-Security-Policy"]');
    if (existingMeta) {
      existingMeta.remove();
    }

    const meta = document.createElement('meta');
    const headerName = this.securityConfig.csp.reportOnly 
      ? 'Content-Security-Policy-Report-Only' 
      : 'Content-Security-Policy';
    
    meta.httpEquiv = headerName;
    meta.content = this.generateCSP();
    document.head.appendChild(meta);
  }

  /**
   * Update security configuration
   */
  static updateConfig(newConfig: Partial<typeof SecurityHeaders.securityConfig>): void {
    this.securityConfig = { ...this.securityConfig, ...newConfig };
  }
}

/**
 * Secure Fetch Wrapper with all security features
 */
export class SecureFetch {
  /**
   * Secure fetch wrapper with CSRF, rate limiting, and validation
   */
  static async fetch(
    url: string,
    options: RequestInit = {},
    rateLimitKey?: string
  ): Promise<Response> {
    // Validate URL
    if (!InputValidator.validateURL(url)) {
      throw new Error('Invalid or unsafe URL');
    }

    // Apply rate limiting
    if (rateLimitKey) {
      if (!RateLimiter.isAllowed(rateLimitKey)) {
        const resetTime = RateLimiter.getResetTime(rateLimitKey);
        throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(resetTime / 1000)} seconds`);
      }
    }

    // Prepare headers with security features
    const headers = {
      ...SecurityHeaders.getSecurityHeaders(),
      ...CSRFProtection.addCSRFHeader(),
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Validate and sanitize request body if present
    if (options.body && typeof options.body === 'string') {
      const validation = InputValidator.validateJSON(options.body);
      if (!validation.isValid) {
        throw new Error(`Invalid request body: ${validation.error}`);
      }
    }

    const secureOptions: RequestInit = {
      ...options,
      headers,
      credentials: 'same-origin', // Prevent CSRF
      mode: 'cors',
    };

    try {
      const response = await fetch(url, secureOptions);
      
      // Check for security-related response headers
      this.validateResponseHeaders(response);
      
      return response;
    } catch (error) {
      throw new Error(`Secure fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate security-related response headers
   */
  private static validateResponseHeaders(response: Response): void {
    const contentType = response.headers.get('Content-Type');
    if (contentType && !contentType.includes('application/json') && !contentType.includes('text/')) {
      console.warn('Unexpected content type in response:', contentType);
    }

    // Check for security headers in response
    const securityHeaders = [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'X-XSS-Protection',
    ];

    for (const header of securityHeaders) {
      if (!response.headers.get(header)) {
        console.warn(`Missing security header in response: ${header}`);
      }
    }
  }
}

/**
 * Initialize security features
 */
export function initializeSecurity(): void {
  // Set CSP meta tag
  SecurityHeaders.setCSPMetaTag();
  
  // Generate initial CSRF token
  CSRFProtection.generateCSRFToken();
  
  // Set up periodic cleanup of rate limiter
  setInterval(() => {
    RateLimiter.cleanup();
  }, 5 * 60 * 1000); // Clean up every 5 minutes
  
  // Add security event listeners
  window.addEventListener('beforeunload', () => {
    // Clear sensitive data on page unload
    CSRFProtection.clearCSRFToken();
  });
}