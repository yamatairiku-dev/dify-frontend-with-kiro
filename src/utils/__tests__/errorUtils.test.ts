/**
 * Tests for Error Utilities
 */

import {
  createError,
  createAuthenticationError,
  createAuthorizationError,
  createNetworkError,
  createValidationError,
  createDifyApiError,
  createRouteError,
  createComponentError,
  isRetryableError,
  shouldLogError,
  sanitizeError,
  formatErrorForDisplay,
  getErrorSeverity,
  createErrorContext,
  fromJavaScriptError,
  errorUtils,
} from '../errorUtils';
import {
  ErrorType,
  ErrorSeverity,
  ErrorLoggingConfig,
} from '../../types/error';

// Mock sessionStorage and localStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

// Mock global objects
Object.defineProperty(global, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true,
});

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('Error Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createError', () => {
    it('should create a basic error with required fields', () => {
      const error = createError(ErrorType.NETWORK_ERROR, 'Test error');

      expect(error.type).toBe(ErrorType.NETWORK_ERROR);
      expect(error.message).toBe('Test error');
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.url).toBeDefined();
      expect(error.userAgent).toBeDefined();
    });

    it('should create error with custom options', () => {
      const error = createError(ErrorType.AUTHENTICATION_ERROR, 'Auth failed', {
        severity: ErrorSeverity.CRITICAL,
        code: 'AUTH_001',
        details: { provider: 'azure' },
      });

      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
      expect(error.code).toBe('AUTH_001');
      expect(error.details).toEqual({ provider: 'azure' });
    });

    it('should get user ID from session storage', () => {
      mockSessionStorage.getItem.mockReturnValue(
        JSON.stringify({ user: { id: 'user123' }, sessionId: 'session456' })
      );

      const error = createError(ErrorType.VALIDATION_ERROR, 'Validation failed');

      expect(error.userId).toBe('user123');
      expect(error.sessionId).toBe('session456');
    });

    it('should fallback to localStorage for user ID', () => {
      mockSessionStorage.getItem.mockReturnValue(null);
      mockLocalStorage.getItem.mockReturnValue(
        JSON.stringify({ user: { id: 'user789' } })
      );

      const error = createError(ErrorType.COMPONENT_ERROR, 'Component failed');

      expect(error.userId).toBe('user789');
    });
  });

  describe('Specific error creators', () => {
    it('should create authentication error', () => {
      const error = createAuthenticationError('Login failed', {
        provider: 'azure',
        authStep: 'callback',
      });

      expect(error.type).toBe(ErrorType.AUTHENTICATION_ERROR);
      expect(error.provider).toBe('azure');
      expect(error.authStep).toBe('callback');
    });

    it('should create authorization error', () => {
      const error = createAuthorizationError('Access denied', {
        resource: 'workflow',
        action: 'execute',
        requiredPermissions: ['workflow:execute'],
      });

      expect(error.type).toBe(ErrorType.AUTHORIZATION_ERROR);
      expect(error.resource).toBe('workflow');
      expect(error.action).toBe('execute');
      expect(error.requiredPermissions).toEqual(['workflow:execute']);
    });

    it('should create network error', () => {
      const error = createNetworkError('Request failed', {
        status: 500,
        statusText: 'Internal Server Error',
        endpoint: '/api/workflows',
        method: 'POST',
        retryCount: 2,
      });

      expect(error.type).toBe(ErrorType.NETWORK_ERROR);
      expect(error.status).toBe(500);
      expect(error.statusText).toBe('Internal Server Error');
      expect(error.endpoint).toBe('/api/workflows');
      expect(error.method).toBe('POST');
      expect(error.retryCount).toBe(2);
    });

    it('should create validation error', () => {
      const error = createValidationError('Invalid input', {
        field: 'email',
        value: 'invalid-email',
        constraint: 'email format',
        validationErrors: [
          { field: 'email', message: 'Invalid email format' },
        ],
      });

      expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(error.field).toBe('email');
      expect(error.value).toBe('invalid-email');
      expect(error.constraint).toBe('email format');
      expect(error.validationErrors).toHaveLength(1);
    });

    it('should create Dify API error', () => {
      const error = createDifyApiError('Workflow execution failed', {
        workflowId: 'wf123',
        executionId: 'exec456',
        apiEndpoint: '/api/workflows/execute',
        apiErrorCode: 'WORKFLOW_TIMEOUT',
      });

      expect(error.type).toBe(ErrorType.DIFY_API_ERROR);
      expect(error.workflowId).toBe('wf123');
      expect(error.executionId).toBe('exec456');
      expect(error.apiEndpoint).toBe('/api/workflows/execute');
      expect(error.apiErrorCode).toBe('WORKFLOW_TIMEOUT');
    });

    it('should create route error', () => {
      const error = createRouteError('Route loading failed', {
        routeName: 'WorkflowDetail',
        routePath: '/workflows/:id',
        params: { id: '123' },
      });

      expect(error.type).toBe(ErrorType.ROUTE_ERROR);
      expect(error.routeName).toBe('WorkflowDetail');
      expect(error.routePath).toBe('/workflows/:id');
      expect(error.params).toEqual({ id: '123' });
    });

    it('should create component error', () => {
      const error = createComponentError('Component render failed', {
        componentName: 'WorkflowList',
        componentStack: 'at WorkflowList\n  at App',
        props: { workflowId: '123' },
      });

      expect(error.type).toBe(ErrorType.COMPONENT_ERROR);
      expect(error.componentName).toBe('WorkflowList');
      expect(error.componentStack).toBe('at WorkflowList\n  at App');
      expect(error.props).toEqual({ workflowId: '123' });
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable network errors', () => {
      const serverError = createNetworkError('Server error', { status: 500 });
      const timeoutError = createNetworkError('Timeout', { status: 408 });
      const rateLimitError = createNetworkError('Rate limit', { status: 429 });
      const noStatusError = createNetworkError('Network failure');

      expect(isRetryableError(serverError)).toBe(true);
      expect(isRetryableError(timeoutError)).toBe(true);
      expect(isRetryableError(rateLimitError)).toBe(true);
      expect(isRetryableError(noStatusError)).toBe(true);
    });

    it('should identify non-retryable network errors', () => {
      const notFoundError = createNetworkError('Not found', { status: 404 });
      const unauthorizedError = createNetworkError('Unauthorized', { status: 401 });

      expect(isRetryableError(notFoundError)).toBe(false);
      expect(isRetryableError(unauthorizedError)).toBe(false);
    });

    it('should identify retryable authentication errors', () => {
      const refreshError = createAuthenticationError('Token refresh failed', {
        authStep: 'refresh',
      });
      const loginError = createAuthenticationError('Login failed', {
        authStep: 'login',
      });

      expect(isRetryableError(refreshError)).toBe(true);
      expect(isRetryableError(loginError)).toBe(false);
    });

    it('should identify retryable component and route errors', () => {
      const componentError = createComponentError('Component failed');
      const routeError = createRouteError('Route failed');

      expect(isRetryableError(componentError)).toBe(true);
      expect(isRetryableError(routeError)).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      const authzError = createAuthorizationError('Access denied');
      const validationError = createValidationError('Invalid input');

      expect(isRetryableError(authzError)).toBe(false);
      expect(isRetryableError(validationError)).toBe(false);
    });
  });

  describe('shouldLogError', () => {
    const config: ErrorLoggingConfig = {
      enableConsoleLogging: true,
      enableRemoteLogging: true,
      logLevel: ErrorSeverity.MEDIUM,
      excludePersonalInfo: true,
      maxStackTraceLength: 1000,
    };

    it('should log errors at or above threshold', () => {
      const lowError = createError(ErrorType.VALIDATION_ERROR, 'Low', {
        severity: ErrorSeverity.LOW,
      });
      const mediumError = createError(ErrorType.NETWORK_ERROR, 'Medium', {
        severity: ErrorSeverity.MEDIUM,
      });
      const highError = createError(ErrorType.AUTHENTICATION_ERROR, 'High', {
        severity: ErrorSeverity.HIGH,
      });

      expect(shouldLogError(lowError, config)).toBe(false);
      expect(shouldLogError(mediumError, config)).toBe(true);
      expect(shouldLogError(highError, config)).toBe(true);
    });
  });

  describe('sanitizeError', () => {
    it('should sanitize personal information', () => {
      const error = createError(ErrorType.NETWORK_ERROR, 'Test error', {
        userId: 'user123',
        userAgent: 'Mozilla/5.0',
        url: 'https://example.com/test?token=secret&user=john',
        stack: 'Error\n  at /Users/john/project/file.js:10:5',
        details: {
          email: 'john@example.com',
          password: 'secret123',
          data: { name: 'John' },
        },
      });

      const sanitized = sanitizeError(error, true);

      expect(sanitized.userId).toBeUndefined();
      expect(sanitized.userAgent).toBeUndefined();
      expect(sanitized.url).toBe('https://example.com/test');
      expect(sanitized.stack).toContain('/Users/[user]');
      expect(sanitized.details.email).toBe('[redacted]');
      expect(sanitized.details.password).toBe('[redacted]');
      expect(sanitized.details.data.name).toBe('John');
    });

    it('should not sanitize when excludePersonalInfo is false', () => {
      const error = createError(ErrorType.NETWORK_ERROR, 'Test error', {
        userId: 'user123',
        details: { email: 'john@example.com' },
      });

      const sanitized = sanitizeError(error, false);

      expect(sanitized.userId).toBe('user123');
      expect(sanitized.details.email).toBe('john@example.com');
    });
  });

  describe('formatErrorForDisplay', () => {
    it('should format authentication errors', () => {
      const error = createAuthenticationError('Auth failed');
      const formatted = formatErrorForDisplay(error);
      expect(formatted).toBe('Authentication failed. Please try logging in again.');
    });

    it('should format authorization errors', () => {
      const error = createAuthorizationError('Access denied');
      const formatted = formatErrorForDisplay(error);
      expect(formatted).toBe('You do not have permission to access this resource.');
    });

    it('should format network errors with specific status codes', () => {
      const notFoundError = createNetworkError('Not found', { status: 404 });
      const serverError = createNetworkError('Server error', { status: 500 });
      const rateLimitError = createNetworkError('Rate limit', { status: 429 });

      expect(formatErrorForDisplay(notFoundError)).toBe('The requested resource was not found.');
      expect(formatErrorForDisplay(serverError)).toBe('Server error occurred. Please try again later.');
      expect(formatErrorForDisplay(rateLimitError)).toBe('Too many requests. Please wait a moment and try again.');
    });

    it('should format validation errors with details', () => {
      const error = createValidationError('Validation failed', {
        validationErrors: [
          { field: 'email', message: 'Invalid email' },
          { field: 'password', message: 'Too short' },
        ],
      });

      const formatted = formatErrorForDisplay(error);
      expect(formatted).toBe('Validation failed: Invalid email, Too short');
    });
  });

  describe('createErrorContext', () => {
    it('should create error context with generated ID', () => {
      const context = createErrorContext();

      expect(context.errorId).toMatch(/^error-\d+-[a-z0-9]+$/);
      expect(context.timestamp).toBeInstanceOf(Date);
      expect(context.url).toBeDefined();
      expect(context.userAgent).toBeDefined();
    });

    it('should create error context with custom values', () => {
      const context = createErrorContext('custom-id', 'TestRoute', 'component stack');

      expect(context.errorId).toBe('custom-id');
      expect(context.routeName).toBe('TestRoute');
      expect(context.componentStack).toBe('component stack');
    });
  });

  describe('fromJavaScriptError', () => {
    it('should convert JavaScript error to AppError', () => {
      const jsError = new Error('JavaScript error');
      jsError.stack = 'Error: JavaScript error\n  at test.js:10:5';

      const appError = fromJavaScriptError(jsError, ErrorType.COMPONENT_ERROR, {
        severity: ErrorSeverity.HIGH,
      });

      expect(appError.type).toBe(ErrorType.COMPONENT_ERROR);
      expect(appError.message).toBe('JavaScript error');
      expect(appError.severity).toBe(ErrorSeverity.HIGH);
      expect(appError.stack).toBe(jsError.stack);
    });

    it('should use default error type', () => {
      const jsError = new Error('Test error');
      const appError = fromJavaScriptError(jsError);

      expect(appError.type).toBe(ErrorType.UNKNOWN_ERROR);
      expect(appError.severity).toBe(ErrorSeverity.MEDIUM);
    });
  });

  describe('errorUtils object', () => {
    it('should export all utility functions', () => {
      expect(errorUtils.createError).toBe(createError);
      expect(errorUtils.isRetryableError).toBe(isRetryableError);
      expect(errorUtils.shouldLogError).toBe(shouldLogError);
      expect(errorUtils.sanitizeError).toBe(sanitizeError);
      expect(errorUtils.formatErrorForDisplay).toBe(formatErrorForDisplay);
      expect(errorUtils.getErrorSeverity).toBe(getErrorSeverity);
      expect(errorUtils.createErrorContext).toBe(createErrorContext);
      expect(errorUtils.fromJavaScriptError).toBe(fromJavaScriptError);
    });
  });
});