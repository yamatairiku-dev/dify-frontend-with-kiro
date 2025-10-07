/**
 * Security configuration for the application
 */

export interface SecurityConfig {
  csp: {
    enabled: boolean;
    reportOnly: boolean;
    directives: Record<string, string[]>;
  };
  rateLimiting: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
    endpoints: Record<string, { maxRequests: number; windowMs: number }>;
  };
  csrf: {
    enabled: boolean;
    tokenName: string;
    headerName: string;
  };
  inputValidation: {
    enabled: boolean;
    maxInputLength: number;
    maxJsonSize: number;
    allowedFileTypes: string[];
  };
  headers: {
    hsts: boolean;
    nosniff: boolean;
    frameOptions: string;
    xssProtection: boolean;
    referrerPolicy: string;
    permissionsPolicy: string;
  };
}

/**
 * Get security configuration based on environment
 */
export function getSecurityConfig(): SecurityConfig {
  const isDevelopment = process.env['NODE_ENV'] === 'development';
  const isProduction = process.env['NODE_ENV'] === 'production';

  return {
    csp: {
      enabled: true,
      reportOnly: isDevelopment, // Report-only in development, enforce in production
      directives: {
        'default-src': ["'self'"],
        'script-src': [
          "'self'",
          ...(isDevelopment ? ["'unsafe-eval'", "'unsafe-inline'"] : []),
          // Allow specific CDNs if needed
          'https://cdn.jsdelivr.net',
        ],
        'style-src': [
          "'self'",
          "'unsafe-inline'", // Required for CSS-in-JS libraries
          'https://fonts.googleapis.com',
        ],
        'img-src': [
          "'self'",
          'data:',
          'https:',
          'blob:',
        ],
        'font-src': [
          "'self'",
          'data:',
          'https://fonts.gstatic.com',
        ],
        'connect-src': [
          "'self'",
          // OAuth providers
          'https://login.microsoftonline.com',
          'https://github.com',
          'https://accounts.google.com',
          'https://oauth2.googleapis.com',
          'https://www.googleapis.com',
          'https://api.github.com',
          'https://graph.microsoft.com',
          // API endpoints
          process.env['VITE_API_BASE_URL'] || 'http://localhost:3001',
          process.env['VITE_DIFY_API_URL'] || 'http://localhost:8080',
          ...(isDevelopment ? [
            'ws:',
            'wss:',
            'http://localhost:*',
            'https://localhost:*',
          ] : []),
        ],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'object-src': ["'none'"],
        'media-src': ["'self'", 'data:', 'blob:'],
        'worker-src': ["'self'", 'blob:'],
        'manifest-src': ["'self'"],
        ...(isProduction ? { 'upgrade-insecure-requests': [] } : {}),
      },
    },
    rateLimiting: {
      enabled: true,
      windowMs: 60000, // 1 minute
      maxRequests: 100, // 100 requests per minute by default
      endpoints: {
        // OAuth endpoints
        '/api/auth/oauth/exchange': { maxRequests: 5, windowMs: 60000 },
        '/api/auth/refresh': { maxRequests: 10, windowMs: 60000 },
        '/api/auth/logout': { maxRequests: 5, windowMs: 60000 },
        
        // Dify API endpoints
        '/api/v1/workflows': { maxRequests: 30, windowMs: 60000 },
        '/api/v1/workflows/*/execute': { maxRequests: 10, windowMs: 60000 },
        '/api/v1/executions/*/status': { maxRequests: 60, windowMs: 60000 },
        
        // General API
        '/api/*': { maxRequests: 60, windowMs: 60000 },
      },
    },
    csrf: {
      enabled: true,
      tokenName: 'csrf_token',
      headerName: 'X-CSRF-Token',
    },
    inputValidation: {
      enabled: true,
      maxInputLength: 10000, // 10KB for individual string inputs
      maxJsonSize: 100000, // 100KB for JSON payloads
      allowedFileTypes: [
        'application/json',
        'text/plain',
        'text/csv',
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
      ],
    },
    headers: {
      hsts: isProduction,
      nosniff: true,
      frameOptions: 'DENY',
      xssProtection: true,
      referrerPolicy: 'strict-origin-when-cross-origin',
      permissionsPolicy: 'geolocation=(), microphone=(), camera=(), payment=(), usb=()',
    },
  };
}

/**
 * Generate CSP string from configuration
 */
export function generateCSPString(config: SecurityConfig): string {
  const directives = Object.entries(config.csp.directives)
    .filter(([, sources]) => sources !== undefined)
    .map(([directive, sources]) => `${directive} ${sources!.join(' ')}`)
    .join('; ');

  return directives;
}

/**
 * Get security headers for HTTP responses
 */
export function getSecurityHeaders(config: SecurityConfig): Record<string, string> {
  const headers: Record<string, string> = {};

  if (config.headers.hsts) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
  }

  if (config.headers.nosniff) {
    headers['X-Content-Type-Options'] = 'nosniff';
  }

  if (config.headers.frameOptions) {
    headers['X-Frame-Options'] = config.headers.frameOptions;
  }

  if (config.headers.xssProtection) {
    headers['X-XSS-Protection'] = '1; mode=block';
  }

  if (config.headers.referrerPolicy) {
    headers['Referrer-Policy'] = config.headers.referrerPolicy;
  }

  if (config.headers.permissionsPolicy) {
    headers['Permissions-Policy'] = config.headers.permissionsPolicy;
  }

  // CSP header
  const cspString = generateCSPString(config);
  if (cspString) {
    const headerName = config.csp.reportOnly 
      ? 'Content-Security-Policy-Report-Only' 
      : 'Content-Security-Policy';
    headers[headerName] = cspString;
  }

  return headers;
}

/**
 * Validate security configuration
 */
export function validateSecurityConfig(config: SecurityConfig): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate CSP directives
  if (config.csp.enabled) {
    const requiredDirectives = ['default-src', 'script-src', 'style-src'];
    for (const directive of requiredDirectives) {
      if (!config.csp.directives[directive]) {
        errors.push(`Missing required CSP directive: ${directive}`);
      }
    }

    // Check for unsafe directives in production
    if (process.env['NODE_ENV'] === 'production') {
      const unsafeDirectives = ['script-src', 'style-src'];
      for (const directive of unsafeDirectives) {
        const sources = config.csp.directives[directive] || [];
        if (sources.includes("'unsafe-eval'") || sources.includes("'unsafe-inline'")) {
          errors.push(`Unsafe CSP directive in production: ${directive} contains unsafe-eval or unsafe-inline`);
        }
      }
    }
  }

  // Validate rate limiting configuration
  if (config.rateLimiting.enabled) {
    if (config.rateLimiting.maxRequests <= 0) {
      errors.push('Rate limiting maxRequests must be greater than 0');
    }
    if (config.rateLimiting.windowMs <= 0) {
      errors.push('Rate limiting windowMs must be greater than 0');
    }
  }

  // Validate input validation limits
  if (config.inputValidation.enabled) {
    if (config.inputValidation.maxInputLength <= 0) {
      errors.push('Input validation maxInputLength must be greater than 0');
    }
    if (config.inputValidation.maxJsonSize <= 0) {
      errors.push('Input validation maxJsonSize must be greater than 0');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Default security configuration
 */
export const defaultSecurityConfig = getSecurityConfig();

/**
 * Validate the default configuration on module load
 */
const validation = validateSecurityConfig(defaultSecurityConfig);
if (!validation.isValid) {
  console.error('Invalid security configuration:', validation.errors);
}