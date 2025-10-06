/**
 * Tests for Specific Error Handlers
 */

import {
  AuthenticationErrorHandler,
  AuthorizationErrorHandler,
  NetworkErrorHandler,
  DifyApiErrorHandler,
  UnifiedErrorHandler,
} from '../specificErrorHandlers';
import {
  createAuthenticationError,
  createAuthorizationError,
  createNetworkError,
  createDifyApiError,
} from '../../utils/errorUtils';
import { ErrorSeverity } from '../../types/error';
import { TokenRefreshService } from '../tokenRefresh';
import { TokenManager } from '../tokenManager';

// Mock dependencies
jest.mock('../tokenRefresh');
jest.mock('../tokenManager');
jest.mock('../errorLoggingService', () => ({
  logError: jest.fn().mockResolvedValue(undefined),
}));

const mockTokenRefreshService = TokenRefreshService as jest.Mocked<typeof TokenRefreshService>;
const mockTokenManager = TokenManager as jest.Mocked<typeof TokenManager>;

describe('AuthenticationErrorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AuthenticationErrorHandler.clearRetryCount();
  });

  describe('handleAuthenticationError', () => {
    it('should handle token refresh errors with retry', async () => {
      const error = createAuthenticationError('Token expired', {
        provider: 'azure',
        authStep: 'refresh',
      });

      const mockOperation = jest.fn().mockResolvedValue('success');
      mockTokenRefreshService.refreshAccessToken.mockResolvedValue({
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
        expiresAt: Date.now() + 3600000,
        user: { id: '1', email: 'test@example.com', name: 'Test User' } as any,
      });

      const result = await AuthenticationErrorHandler.handleAuthenticationError(
        error,
        mockOperation,
        { provider: 'azure', authStep: 'refresh' }
      );

      expect(result).toBe('success');
      expect(mockTokenRefreshService.refreshAccessToken).toHaveBeenCalled();
      expect(mockOperation).toHaveBeenCalled();
    });

    it('should force logout after max refresh retries', async () => {
      const error = createAuthenticationError('Token expired', {
        provider: 'azure',
        authStep: 'refresh',
      });

      const mockOperation = jest.fn().mockRejectedValue(error);
      mockTokenRefreshService.refreshAccessToken.mockResolvedValue(null);

      await expect(
        AuthenticationErrorHandler.handleAuthenticationError(
          error,
          mockOperation,
          { provider: 'azure', authStep: 'refresh' }
        )
      ).rejects.toThrow('Authentication session expired');

      expect(mockTokenManager.clearSession).toHaveBeenCalled();
    });

    it('should handle login errors with retry', async () => {
      const error = createAuthenticationError('Login failed', {
        provider: 'github',
        authStep: 'login',
      });

      const mockOperation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const result = await AuthenticationErrorHandler.handleAuthenticationError(
        error,
        mockOperation,
        { provider: 'github', authStep: 'login' }
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('should not retry callback errors', async () => {
      const error = createAuthenticationError('Callback failed', {
        provider: 'google',
        authStep: 'callback',
      });

      const mockOperation = jest.fn();

      await expect(
        AuthenticationErrorHandler.handleAuthenticationError(
          error,
          mockOperation,
          { provider: 'google', authStep: 'callback' }
        )
      ).rejects.toThrow('Authentication callback failed');

      expect(mockOperation).not.toHaveBeenCalled();
    });
  });
});

describe('AuthorizationErrorHandler', () => {
  describe('handleAuthorizationError', () => {
    it('should create detailed authorization error with suggestions', async () => {
      const error = createAuthorizationError('Access denied', {
        resource: 'workflow',
        action: 'execute',
        requiredPermissions: ['workflow:execute'],
      });

      await expect(
        AuthorizationErrorHandler.handleAuthorizationError(error, {
          resource: 'workflow',
          action: 'execute',
          routeName: 'workflows',
          userPermissions: ['workflow:read'],
        })
      ).rejects.toThrow('You do not have permission to execute workflows');
    });

    it('should provide admin-specific messaging', async () => {
      const error = createAuthorizationError('Admin access denied', {
        resource: 'admin',
        action: 'access',
      });

      await expect(
        AuthorizationErrorHandler.handleAuthorizationError(error, {
          resource: 'admin',
          action: 'access',
        })
      ).rejects.toThrow('You do not have permission to access administrative features');
    });
  });
});

describe('NetworkErrorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    NetworkErrorHandler.clearRetryCount();
  });

  describe('handleNetworkError', () => {
    it('should retry retryable network errors', async () => {
      const error = createNetworkError('Server error', {
        status: 500,
        endpoint: '/api/test',
        method: 'GET',
      });

      const mockOperation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const result = await NetworkErrorHandler.handleNetworkError(
        error,
        mockOperation,
        { endpoint: '/api/test', method: 'GET' }
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      const error = createNetworkError('Bad request', {
        status: 400,
        endpoint: '/api/test',
        method: 'POST',
      });

      const mockOperation = jest.fn();

      await expect(
        NetworkErrorHandler.handleNetworkError(
          error,
          mockOperation,
          { endpoint: '/api/test', method: 'POST' }
        )
      ).rejects.toThrow('Invalid request');

      expect(mockOperation).not.toHaveBeenCalled();
    });

    it('should handle rate limiting with special delay', async () => {
      const error = createNetworkError('Rate limited', {
        status: 429,
        endpoint: '/api/test',
        method: 'GET',
      });

      const mockOperation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      // Mock setTimeout to avoid actual delays in tests
      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        callback();
        return {} as any;
      });

      const result = await NetworkErrorHandler.handleNetworkError(
        error,
        mockOperation,
        { endpoint: '/api/test', method: 'GET' }
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);

      jest.restoreAllMocks();
    });

    it('should provide user-friendly error messages', async () => {
      const error = createNetworkError('Not found', {
        status: 404,
        endpoint: '/api/missing',
        method: 'GET',
      });

      const mockOperation = jest.fn();

      await expect(
        NetworkErrorHandler.handleNetworkError(
          error,
          mockOperation,
          { endpoint: '/api/missing', method: 'GET' }
        )
      ).rejects.toThrow('The requested resource was not found');
    });

    it('should handle connection errors', async () => {
      const error = createNetworkError('Network error', {
        endpoint: '/api/test',
        method: 'GET',
      });

      const mockOperation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      // Mock setTimeout
      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        callback();
        return {} as any;
      });

      const result = await NetworkErrorHandler.handleNetworkError(
        error,
        mockOperation,
        { endpoint: '/api/test', method: 'GET' }
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);

      jest.restoreAllMocks();
    });
  });
});

describe('DifyApiErrorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    DifyApiErrorHandler.clearRetryCount();
  });

  describe('handleDifyApiError', () => {
    it('should retry retryable Dify API errors', async () => {
      const error = createDifyApiError('Workflow busy', {
        workflowId: 'workflow-1',
        apiErrorCode: 'WORKFLOW_BUSY',
      });

      const mockOperation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      // Mock setTimeout
      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        callback();
        return {} as any;
      });

      const result = await DifyApiErrorHandler.handleDifyApiError(
        error,
        mockOperation,
        { workflowId: 'workflow-1', workflowName: 'Test Workflow' }
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);

      jest.restoreAllMocks();
    });

    it('should not retry non-retryable errors', async () => {
      const error = createDifyApiError('Invalid input', {
        workflowId: 'workflow-1',
        apiErrorCode: 'INVALID_INPUT',
      });

      const mockOperation = jest.fn();

      await expect(
        DifyApiErrorHandler.handleDifyApiError(
          error,
          mockOperation,
          { workflowId: 'workflow-1', workflowName: 'Test Workflow' }
        )
      ).rejects.toThrow('Invalid input provided to Test Workflow');

      expect(mockOperation).not.toHaveBeenCalled();
    });

    it('should provide workflow-specific error messages', async () => {
      const error = createDifyApiError('Workflow not found', {
        workflowId: 'missing-workflow',
        apiErrorCode: 'WORKFLOW_NOT_FOUND',
      });

      const mockOperation = jest.fn();

      await expect(
        DifyApiErrorHandler.handleDifyApiError(
          error,
          mockOperation,
          { workflowId: 'missing-workflow', workflowName: 'Missing Workflow' }
        )
      ).rejects.toThrow('Missing Workflow was not found or is no longer available');
    });

    it('should handle execution failures', async () => {
      const error = createDifyApiError('Execution failed', {
        workflowId: 'workflow-1',
        executionId: 'exec-1',
        apiErrorCode: 'EXECUTION_FAILED',
      });

      const mockOperation = jest.fn();

      await expect(
        DifyApiErrorHandler.handleDifyApiError(
          error,
          mockOperation,
          { 
            workflowId: 'workflow-1', 
            workflowName: 'Test Workflow',
            executionId: 'exec-1'
          }
        )
      ).rejects.toThrow('Test Workflow execution failed due to an internal error');
    });

    it('should handle timeout errors with retry', async () => {
      const error = createDifyApiError('Timeout', {
        workflowId: 'workflow-1',
        apiErrorCode: 'TIMEOUT',
      });

      const mockOperation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      // Mock setTimeout
      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        callback();
        return {} as any;
      });

      const result = await DifyApiErrorHandler.handleDifyApiError(
        error,
        mockOperation,
        { workflowId: 'workflow-1', workflowName: 'Test Workflow' }
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);

      jest.restoreAllMocks();
    });
  });
});

describe('UnifiedErrorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    UnifiedErrorHandler.clearAllRetryCounts();
  });

  describe('handleError', () => {
    it('should route authentication errors to AuthenticationErrorHandler', async () => {
      const error = createAuthenticationError('Auth error', {
        provider: 'azure',
        authStep: 'login',
      });

      const mockOperation = jest.fn().mockResolvedValue('success');

      const result = await UnifiedErrorHandler.handleError(
        error,
        mockOperation,
        { provider: 'azure', authStep: 'login' }
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalled();
    });

    it('should route authorization errors to AuthorizationErrorHandler', async () => {
      const error = createAuthorizationError('Access denied', {
        resource: 'workflow',
        action: 'execute',
      });

      const mockOperation = jest.fn();

      await expect(
        UnifiedErrorHandler.handleError(
          error,
          mockOperation,
          { resource: 'workflow', action: 'execute' }
        )
      ).rejects.toThrow('You do not have permission to execute workflows');
    });

    it('should route network errors to NetworkErrorHandler', async () => {
      const error = createNetworkError('Network error', {
        status: 500,
        endpoint: '/api/test',
      });

      const mockOperation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      // Mock setTimeout
      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        callback();
        return {} as any;
      });

      const result = await UnifiedErrorHandler.handleError(
        error,
        mockOperation,
        { endpoint: '/api/test' }
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);

      jest.restoreAllMocks();
    });

    it('should route Dify API errors to DifyApiErrorHandler', async () => {
      const error = createDifyApiError('Dify error', {
        workflowId: 'workflow-1',
        apiErrorCode: 'WORKFLOW_BUSY',
      });

      const mockOperation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      // Mock setTimeout
      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        callback();
        return {} as any;
      });

      const result = await UnifiedErrorHandler.handleError(
        error,
        mockOperation,
        { workflowId: 'workflow-1' }
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);

      jest.restoreAllMocks();
    });

    it('should log and re-throw unknown error types', async () => {
      const error = {
        type: 'UNKNOWN_ERROR',
        message: 'Unknown error',
        severity: ErrorSeverity.MEDIUM,
        timestamp: new Date(),
      } as any;

      const mockOperation = jest.fn();

      await expect(
        UnifiedErrorHandler.handleError(error, mockOperation)
      ).rejects.toEqual(error);
    });
  });

  describe('clearAllRetryCounts', () => {
    it('should clear retry counts for all handlers', () => {
      // This test verifies that the method exists and can be called
      expect(() => UnifiedErrorHandler.clearAllRetryCounts()).not.toThrow();
    });
  });
});

// Integration tests
describe('Error Handler Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    UnifiedErrorHandler.clearAllRetryCounts();
  });

  it('should handle cascading errors correctly', async () => {
    // Start with a network error that becomes an auth error
    const networkError = createNetworkError('Unauthorized', {
      status: 401,
      endpoint: '/api/protected',
    });

    const authError = createAuthenticationError('Token expired', {
      authStep: 'refresh',
    });

    const mockOperation = jest.fn()
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(authError)
      .mockResolvedValue('success');

    mockTokenRefreshService.refreshAccessToken.mockResolvedValue({
      accessToken: 'new-token',
      refreshToken: 'new-refresh',
      expiresAt: Date.now() + 3600000,
      user: { id: '1', email: 'test@example.com', name: 'Test User' } as any,
    });

    // Mock setTimeout
    jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
      callback();
      return {} as any;
    });

    const result = await UnifiedErrorHandler.handleError(
      networkError,
      mockOperation,
      { endpoint: '/api/protected' }
    );

    expect(result).toBe('success');
    expect(mockOperation).toHaveBeenCalledTimes(3);

    jest.restoreAllMocks();
  });

  it('should respect retry limits across error types', async () => {
    const error = createNetworkError('Server error', {
      status: 500,
      endpoint: '/api/test',
    });

    const mockOperation = jest.fn().mockRejectedValue(error);

    // Mock setTimeout
    jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
      callback();
      return {} as any;
    });

    await expect(
      UnifiedErrorHandler.handleError(error, mockOperation)
    ).rejects.toThrow();

    // Should have tried the operation multiple times (original + retries)
    expect(mockOperation.mock.calls.length).toBeGreaterThan(1);

    jest.restoreAllMocks();
  });
});