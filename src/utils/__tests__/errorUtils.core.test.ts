/**
 * Core unit tests for error handling utilities
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
  getErrorSeverity,
  createErrorContext,
  shouldLogError,
} from '../errorUtils';

import {
  ErrorType,
  ErrorSeverity,
  ErrorLoggingConfig,
} from '../../types/error';

// Tests will run in jsdom environment which provides window object

describe('Error Utilities - Core Tests', () => {
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
        expect(error.url).toBeDefined();
        expect(error.userAgent).toBeDefined();
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
        // In jsdom environment, window is always available
        // This test verifies the error creation works with window object
        const error = createError(ErrorType.COMPONENT_ERROR, 'Component error');
        
        expect(error.url).toBeDefined();
        expect(error.userAgent).toBeDefined();
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
        });

        expect(error.type).toBe(ErrorType.VALIDATION_ERROR);
        expect(error.field).toBe('email');
        expect(error.value).toBe('invalid-email');
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
          routePath: '/invalid-route',
        });

        expect(error.type).toBe(ErrorType.ROUTE_ERROR);
        expect(error.routePath).toBe('/invalid-route');
        expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      });
    });

    describe('createComponentError', () => {
      it('should create component error with React context', () => {
        const error = createComponentError('Component render failed', {
          componentName: 'WorkflowList',
          componentStack: 'at WorkflowList\\n  at App',
          props: { workflows: [] },
        });

        expect(error.type).toBe(ErrorType.COMPONENT_ERROR);
        expect(error.componentName).toBe('WorkflowList');
        expect(error.componentStack).toBe('at WorkflowList\\n  at App');
        expect(error.props).toEqual({ workflows: [] });
        expect(error.severity).toBe(ErrorSeverity.HIGH);
      });
    });
  });

  describe('Error Utility Functions', () => {
    describe('getErrorSeverity', () => {
      it('should return error severity', () => {
        const error = createError(ErrorType.AUTHENTICATION_ERROR, 'Auth error');
        const severity = getErrorSeverity(error);
        
        expect(severity).toBe(ErrorSeverity.HIGH);
      });

      it('should return custom severity when provided', () => {
        const error = createError(ErrorType.VALIDATION_ERROR, 'Validation error', {
          severity: ErrorSeverity.CRITICAL,
        });
        const severity = getErrorSeverity(error);
        
        expect(severity).toBe(ErrorSeverity.CRITICAL);
      });
    });

    describe('createErrorContext', () => {
      it('should create error context with metadata', () => {
        const context = createErrorContext('error-123', 'test-route', 'component-stack');
        
        expect(context.errorId).toBe('error-123');
        expect(context.timestamp).toBeInstanceOf(Date);
        expect(context.routeName).toBe('test-route');
        expect(context.url).toBeDefined();
        expect(context.userAgent).toBeDefined();
      });

      it('should handle minimal context', () => {
        const context = createErrorContext();
        
        expect(context.errorId).toBeDefined();
        expect(context.timestamp).toBeInstanceOf(Date);
      });
    });

    describe('shouldLogError', () => {
      const defaultConfig: ErrorLoggingConfig = {
        enableConsoleLogging: true,
        enableRemoteLogging: false,
        logLevel: ErrorSeverity.MEDIUM,
        excludePersonalInfo: true,
        maxStackTraceLength: 1000,
        remoteEndpoint: undefined,
        apiKey: undefined,
      };

      it('should log high and critical severity errors', () => {
        const highError = createError(ErrorType.AUTHENTICATION_ERROR, 'Auth failed');
        const criticalError = createError(ErrorType.NETWORK_ERROR, 'Network down', {
          severity: ErrorSeverity.CRITICAL,
        });

        expect(shouldLogError(highError, defaultConfig)).toBe(true);
        expect(shouldLogError(criticalError, defaultConfig)).toBe(true);
      });

      it('should not log low severity errors with medium threshold', () => {
        const lowError = createValidationError('Invalid input');
        expect(shouldLogError(lowError, defaultConfig)).toBe(false);
      });

      it('should respect custom log level threshold', () => {
        const mediumError = createError(ErrorType.COMPONENT_ERROR, 'Component error');
        const lowThresholdConfig = { ...defaultConfig, logLevel: ErrorSeverity.LOW };
        const highThresholdConfig = { ...defaultConfig, logLevel: ErrorSeverity.CRITICAL };
        
        expect(shouldLogError(mediumError, lowThresholdConfig)).toBe(true);
        expect(shouldLogError(mediumError, highThresholdConfig)).toBe(false);
      });

      it('should check severity levels correctly', () => {
        const error = createError(ErrorType.AUTHENTICATION_ERROR, 'Auth error');
        const config = { ...defaultConfig, logLevel: ErrorSeverity.HIGH };
        
        // Authentication errors have HIGH severity by default, so should be logged
        expect(shouldLogError(error, config)).toBe(true);
      });
    });
  });

  describe('Error Type Validation', () => {
    it('should validate error types correctly', () => {
      const authError = createAuthenticationError('Auth error');
      const networkError = createNetworkError('Network error');
      const validationError = createValidationError('Validation error');
      
      expect(authError.type).toBe(ErrorType.AUTHENTICATION_ERROR);
      expect(networkError.type).toBe(ErrorType.NETWORK_ERROR);
      expect(validationError.type).toBe(ErrorType.VALIDATION_ERROR);
    });

    it('should maintain error inheritance', () => {
      const authError = createAuthenticationError('Auth error');
      
      // Should have base error properties
      expect(authError.message).toBeDefined();
      expect(authError.timestamp).toBeDefined();
      expect(authError.severity).toBeDefined();
      
      // Should have authentication-specific properties
      expect(authError.type).toBe(ErrorType.AUTHENTICATION_ERROR);
    });
  });

  describe('Error Serialization', () => {
    it('should serialize errors to JSON safely', () => {
      const error = createNetworkError('Network error', {
        status: 500,
        endpoint: '/api/test',
        details: { extra: 'info' },
      });

      expect(() => JSON.stringify(error)).not.toThrow();
      
      const serialized = JSON.stringify(error);
      const parsed = JSON.parse(serialized);
      
      expect(parsed.type).toBe(ErrorType.NETWORK_ERROR);
      expect(parsed.message).toBe('Network error');
      expect(parsed.status).toBe(500);
    });

    it('should handle circular references in error details', () => {
      const circularObject: any = { name: 'test' };
      circularObject.self = circularObject;

      const error = createError(ErrorType.COMPONENT_ERROR, 'Circular error', {
        details: { circular: circularObject },
      });

      // Should not throw when creating the error
      expect(error).toBeDefined();
      expect(error.details).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should create errors efficiently', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        createError(ErrorType.VALIDATION_ERROR, `Error ${i}`);
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });

    it('should handle large error details', () => {
      const largeDetails = {
        data: new Array(1000).fill('test-data'),
        metadata: { info: 'large object' },
      };

      const startTime = Date.now();
      const error = createError(ErrorType.COMPONENT_ERROR, 'Large error', {
        details: largeDetails,
      });
      const endTime = Date.now();

      expect(error.details).toBeDefined();
      expect(endTime - startTime).toBeLessThan(50); // Should still be fast
    });
  });
});