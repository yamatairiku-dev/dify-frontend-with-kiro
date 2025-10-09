/**
 * Enhanced unit tests for error handling utilities
 * Task 9.1: Test error handling utilities and components
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
  formatErrorMessage,
  getErrorSeverityLevel,
  shouldLogError,
  sanitizeErrorForLogging,
  extractErrorContext,
  isRetryableError,
  getDefaultSeverity,
} from '../errorUtils';

import {
  ErrorType,
  ErrorSeverity,
  AuthenticationError,
  AuthorizationError,
  NetworkError,
  ValidationError,
  DifyApiError,
  RouteError,
  ComponentError,
} from '../../types/error';

// Mock window and navigator
Object.defineProperty(window, 'location', {
  value: {
    href: 'https://test.example.com/page',
  },
});

Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'Mozilla/5.0 (Test Browser)',
  },
});

describe('Error Utilities - Enhanced Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Error Creation Functions', () => {
    describe('createError', () => {
      it('should create a basic error with required fields', () => {
        const error = createError(ErrorType.VALIDATION_ERROR, 'Test error message');
        
        expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
        expect(error.message).toBe('Test error message');
        expect(error.severity).toBe(ErrorSeverity.LOW);
        expect(error.timestamp).toBeInstanceOf(Date);
        expect(error.url).toBe('https://test.example.com/page');
        expect(error.userAgent).toBe('Mozilla/5.0 (Test Browser)');
      });

      it('should merge provided options with defaults', () => {
        const options = {
          severity: ErrorSeverity.HIGH,
          code: 'TEST_ERROR',
          userId: 'user-123',
        };

        const error = createError(ErrorType.NETWORK_ERROR, 'Network error', options);
        
        expect(error.severity).toBe(ErrorSeverity.HIGH);
        expect(error.code).toBe('TEST_ERROR');
        expect(error.userId).toBe('user-123');
      });

      it('should handle missing window object gracefully', () => {
        const originalWindow = global.window;
        delete (global as any).window;

        const error = createError(ErrorType.COMPONENT_ERROR, 'Component error');
        
        expect(error.url).toBeUndefined();
        expect(error.userAgent).toBeUndefined();

        global.window = originalWindow;
      });
    });

    describe('createAuthenticationError', () => {
      it('should create authentication error with specific properties', () => {
        const error = createAuthenticationError('Login failed', {
          provider: 'azure',
          authStep: 'login',
          code: 'AUTH_FAILED',
        });

        expect(error.type).toBe(ErrorType.AUTHENTICATION_ERROR);
        expect(error.provider).toBe('azure');
        expect(error.authStep).toBe('login');
        expect(error.code).toBe('AUTH_FAILED');
        expect(error.severity).toBe(ErrorSeverity.HIGH);
      });

      it('should handle missing optional properties', () => {
        const error = createAuthenticationError('Generic auth error');

        expect(error.type).toBe(ErrorType.AUTHENTICATION_ERROR);
        expect(error.provider).toBeUndefined();
        expect(error.authStep).toBeUndefined();
      });
    });

    describe('createAuthorizationError', () => {
      it('should create authorization error with permissions', () => {
        const error = createAuthorizationError('Access denied', {
          resource: 'workflow',
          action: 'execute',
          requiredPermissions: ['workflow:execute', 'user:active'],
        });

        expect(error.type).toBe(ErrorType.AUTHORIZATION_ERROR);
        expect(error.resource).toBe('workflow');
        expect(error.action).toBe('execute');
        expect(error.requiredPermissions).toEqual(['workflow:execute', 'user:active']);
        expect(error.severity).toBe(ErrorSeverity.HIGH);
      });
    });

    describe('createNetworkError', () => {
      it('should create network error with HTTP details', () => {
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
        expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      });

      it('should default retry count to 0', () => {
        const error = createNetworkError('Network error');
        expect(error.retryCount).toBe(0);
      });
    });

    describe('createValidationError', () => {
      it('should create validation error with field details', () => {
        const error = createValidationError('Invalid input', {
          field: 'email',
          value: 'invalid-email',
          expectedType: 'email',
          validationRules: ['required', 'email'],
        });

        expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
        expect(error.field).toBe('email');
        expect(error.value).toBe('invalid-email');
        expect(error.expectedType).toBe('email');
        expect(error.validationRules).toEqual(['required', 'email']);
        expect(error.severity).toBe(ErrorSeverity.LOW);
      });
    });

    describe('createDifyApiError', () => {
      it('should create Dify API error with workflow context', () => {
        const error = createDifyApiError('Workflow execution failed', {
          workflowId: 'workflow-123',
          executionId: 'exec-456',
          apiEndpoint: '/workflows/execute',
          apiErrorCode: 'EXECUTION_FAILED',
        });

        expect(error.type).toBe(ErrorType.DIFY_API_ERROR);
        expect(error.workflowId).toBe('workflow-123');
        expect(error.executionId).toBe('exec-456');
        expect(error.apiEndpoint).toBe('/workflows/execute');
        expect(error.apiErrorCode).toBe('EXECUTION_FAILED');
        expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      });
    });

    describe('createRouteError', () => {
      it('should create route error with navigation context', () => {
        const error = createRouteError('Route not found', {
          route: '/invalid-route',
          expectedRoute: '/workflows',
          navigationContext: { from: '/dashboard', action: 'navigate' },
        });

        expect(error.type).toBe(ErrorType.ROUTE_ERROR);
        expect(error.route).toBe('/invalid-route');
        expect(error.expectedRoute).toBe('/workflows');
        expect(error.navigationContext).toEqual({ from: '/dashboard', action: 'navigate' });
        expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      });
    });

    describe('createComponentError', () => {
      it('should create component error with React context', () => {
        const error = createComponentError('Component render failed', {
          componentName: 'WorkflowList',
          componentStack: 'at WorkflowList\\n  at App',
          props: { workflows: [] },
          state: { loading: false },
        });

        expect(error.type).toBe(ErrorType.COMPONENT_ERROR);
        expect(error.componentName).toBe('WorkflowList');
        expect(error.componentStack).toBe('at WorkflowList\\n  at App');
        expect(error.props).toEqual({ workflows: [] });
        expect(error.state).toEqual({ loading: false });
        expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      });
    });
  });

  describe('Error Utility Functions', () => {
    describe('formatErrorMessage', () => {
      it('should format error message with context', () => {
        const error = createNetworkError('Request failed', {
          status: 404,
          endpoint: '/api/workflows',
        });

        const formatted = formatErrorMessage(error);
        
        expect(formatted).toContain('Request failed');
        expect(formatted).toContain('404');
        expect(formatted).toContain('/api/workflows');
      });

      it('should handle errors without additional context', () => {
        const error = createError(ErrorType.UNKNOWN_ERROR, 'Generic error');
        const formatted = formatErrorMessage(error);
        
        expect(formatted).toBe('Generic error');
      });

      it('should include user-friendly suggestions when available', () => {
        const error = createAuthorizationError('Access denied', {
          details: {
            suggestions: ['Contact your administrator', 'Check your permissions'],
          },
        });

        const formatted = formatErrorMessage(error, { includeSuggestions: true });
        
        expect(formatted).toContain('Contact your administrator');
        expect(formatted).toContain('Check your permissions');
      });
    });

    describe('getErrorSeverityLevel', () => {
      it('should return numeric severity levels', () => {
        expect(getErrorSeverityLevel(ErrorSeverity.LOW)).toBe(1);
        expect(getErrorSeverityLevel(ErrorSeverity.MEDIUM)).toBe(2);
        expect(getErrorSeverityLevel(ErrorSeverity.HIGH)).toBe(3);
        expect(getErrorSeverityLevel(ErrorSeverity.CRITICAL)).toBe(4);
      });

      it('should handle invalid severity gracefully', () => {
        expect(getErrorSeverityLevel('INVALID' as ErrorSeverity)).toBe(0);
      });
    });

    describe('shouldLogError', () => {
      it('should log high and critical severity errors', () => {
        const highError = createError(ErrorType.AUTHENTICATION_ERROR, 'Auth failed');
        const criticalError = createError(ErrorType.NETWORK_ERROR, 'Network down', {
          severity: ErrorSeverity.CRITICAL,
        });

        expect(shouldLogError(highError)).toBe(true);
        expect(shouldLogError(criticalError)).toBe(true);
      });

      it('should not log low severity errors by default', () => {
        const lowError = createValidationError('Invalid input');
        expect(shouldLogError(lowError)).toBe(false);
      });

      it('should respect custom severity threshold', () => {
        const mediumError = createError(ErrorType.COMPONENT_ERROR, 'Component error');
        
        expect(shouldLogError(mediumError, ErrorSeverity.MEDIUM)).toBe(true);
        expect(shouldLogError(mediumError, ErrorSeverity.HIGH)).toBe(false);
      });
    });

    describe('sanitizeErrorForLogging', () => {
      it('should remove sensitive information from error', () => {
        const error = createAuthenticationError('Login failed', {
          details: {
            password: 'secret123',
            token: 'bearer-token',
            apiKey: 'api-key-123',
            email: 'user@example.com',
            publicInfo: 'safe-data',
          },
        });

        const sanitized = sanitizeErrorForLogging(error);
        
        expect(sanitized.details.password).toBe('[REDACTED]');
        expect(sanitized.details.token).toBe('[REDACTED]');
        expect(sanitized.details.apiKey).toBe('[REDACTED]');
        expect(sanitized.details.email).toBe('user@example.com'); // Email is preserved
        expect(sanitized.details.publicInfo).toBe('safe-data');
      });

      it('should handle errors without details', () => {
        const error = createError(ErrorType.VALIDATION_ERROR, 'Simple error');
        const sanitized = sanitizeErrorForLogging(error);
        
        expect(sanitized).toEqual(error);
      });

      it('should preserve error structure while sanitizing', () => {
        const error = createNetworkError('Request failed', {
          details: {
            headers: {
              'Authorization': 'Bearer secret-token',
              'Content-Type': 'application/json',
            },
          },
        });

        const sanitized = sanitizeErrorForLogging(error);
        
        expect(sanitized.type).toBe(error.type);
        expect(sanitized.message).toBe(error.message);
        expect(sanitized.details.headers['Authorization']).toBe('[REDACTED]');
        expect(sanitized.details.headers['Content-Type']).toBe('application/json');
      });
    });

    describe('extractErrorContext', () => {
      it('should extract relevant context from error', () => {
        const error = createDifyApiError('Workflow failed', {
          workflowId: 'workflow-123',
          executionId: 'exec-456',
          details: {
            input: { message: 'test' },
            timestamp: '2024-01-01T00:00:00Z',
          },
        });

        const context = extractErrorContext(error);
        
        expect(context.errorType).toBe(ErrorType.DIFY_API_ERROR);
        expect(context.workflowId).toBe('workflow-123');
        expect(context.executionId).toBe('exec-456');
        expect(context.timestamp).toBeDefined();
      });

      it('should handle errors with minimal context', () => {
        const error = createError(ErrorType.UNKNOWN_ERROR, 'Unknown error');
        const context = extractErrorContext(error);
        
        expect(context.errorType).toBe(ErrorType.UNKNOWN_ERROR);
        expect(context.timestamp).toBeDefined();
      });
    });

    describe('isRetryableError', () => {
      it('should identify retryable network errors', () => {
        const retryableError = createNetworkError('Server error', { status: 500 });
        const nonRetryableError = createNetworkError('Bad request', { status: 400 });

        expect(isRetryableError(retryableError)).toBe(true);
        expect(isRetryableError(nonRetryableError)).toBe(false);
      });

      it('should identify retryable authentication errors', () => {
        const retryableError = createAuthenticationError('Token expired', {
          authStep: 'refresh',
        });
        const nonRetryableError = createAuthenticationError('Invalid credentials', {
          authStep: 'login',
        });

        expect(isRetryableError(retryableError)).toBe(true);
        expect(isRetryableError(nonRetryableError)).toBe(false);
      });

      it('should not retry authorization errors', () => {
        const authzError = createAuthorizationError('Access denied');
        expect(isRetryableError(authzError)).toBe(false);
      });

      it('should identify retryable Dify API errors', () => {
        const retryableError = createDifyApiError('Workflow busy', {
          apiErrorCode: 'WORKFLOW_BUSY',
        });
        const nonRetryableError = createDifyApiError('Invalid input', {
          apiErrorCode: 'INVALID_INPUT',
        });

        expect(isRetryableError(retryableError)).toBe(true);
        expect(isRetryableError(nonRetryableError)).toBe(false);
      });
    });

    describe('getDefaultSeverity', () => {
      it('should return appropriate default severity for each error type', () => {
        expect(getDefaultSeverity(ErrorType.AUTHENTICATION_ERROR)).toBe(ErrorSeverity.HIGH);
        expect(getDefaultSeverity(ErrorType.AUTHORIZATION_ERROR)).toBe(ErrorSeverity.HIGH);
        expect(getDefaultSeverity(ErrorType.NETWORK_ERROR)).toBe(ErrorSeverity.MEDIUM);
        expect(getDefaultSeverity(ErrorType.VALIDATION_ERROR)).toBe(ErrorSeverity.LOW);
        expect(getDefaultSeverity(ErrorType.DIFY_API_ERROR)).toBe(ErrorSeverity.MEDIUM);
        expect(getDefaultSeverity(ErrorType.ROUTE_ERROR)).toBe(ErrorSeverity.MEDIUM);
        expect(getDefaultSeverity(ErrorType.COMPONENT_ERROR)).toBe(ErrorSeverity.MEDIUM);
        expect(getDefaultSeverity(ErrorType.UNKNOWN_ERROR)).toBe(ErrorSeverity.MEDIUM);
      });
    });
  });

  describe('Error Chaining and Causality', () => {
    it('should support error chaining with cause', () => {
      const rootCause = createNetworkError('Connection failed');
      const chainedError = createDifyApiError('Workflow execution failed', {
        details: { cause: rootCause },
      });

      expect(chainedError.details?.cause).toBe(rootCause);
    });

    it('should extract root cause from error chain', () => {
      const rootCause = createValidationError('Invalid input');
      const intermediateError = createDifyApiError('Processing failed', {
        details: { cause: rootCause },
      });
      const topLevelError = createComponentError('Render failed', {
        details: { cause: intermediateError },
      });

      const extractedRootCause = extractErrorContext(topLevelError).rootCause;
      expect(extractedRootCause).toBe(rootCause);
    });
  });

  describe('Error Aggregation', () => {
    it('should aggregate multiple related errors', () => {
      const errors = [
        createValidationError('Field A is required'),
        createValidationError('Field B is invalid'),
        createValidationError('Field C is too long'),
      ];

      const aggregatedError = createValidationError('Multiple validation errors', {
        details: { aggregatedErrors: errors },
      });

      expect(aggregatedError.details?.aggregatedErrors).toHaveLength(3);
      expect(aggregatedError.details?.aggregatedErrors).toEqual(errors);
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large error objects efficiently', () => {
      const largeDetails = {
        data: new Array(10000).fill('test-data'),
        metadata: new Array(1000).fill({ key: 'value' }),
      };

      const startTime = Date.now();
      const error = createError(ErrorType.COMPONENT_ERROR, 'Large error', {
        details: largeDetails,
      });
      const endTime = Date.now();

      expect(error.details).toBeDefined();
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });

    it('should not cause memory leaks with circular references', () => {
      const circularObject: any = { name: 'test' };
      circularObject.self = circularObject;

      expect(() => {
        createError(ErrorType.COMPONENT_ERROR, 'Circular reference error', {
          details: { circular: circularObject },
        });
      }).not.toThrow();
    });
  });
});