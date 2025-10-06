/**
 * Tests for Error Handling Hooks
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import {
  useAuthenticationErrorHandling,
  useAuthorizationErrorHandling,
  useNetworkErrorHandling,
  useDifyApiErrorHandling,
  useUnifiedErrorHandling,
  useAsyncWithErrorHandling,
} from '../useErrorHandling';
import {
  createAuthenticationError,
  createAuthorizationError,
  createNetworkError,
  createDifyApiError,
} from '../../utils/errorUtils';
import { AuthContext } from '../../context/AuthContext';
import { User } from '../../types/auth';

// Mock the error handlers
jest.mock('../../services/specificErrorHandlers', () => ({
  AuthenticationErrorHandler: {
    handleAuthenticationError: jest.fn(),
  },
  AuthorizationErrorHandler: {
    handleAuthorizationError: jest.fn(),
  },
  NetworkErrorHandler: {
    handleNetworkError: jest.fn(),
  },
  DifyApiErrorHandler: {
    handleDifyApiError: jest.fn(),
  },
  UnifiedErrorHandler: {
    handleError: jest.fn(),
  },
}));

const mockAuthHandlers = require('../../services/specificErrorHandlers');

// Mock auth context
const mockUser: User = {
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  provider: 'azure',
  attributes: {
    domain: 'example.com',
    roles: ['user'],
  },
  permissions: [
    {
      resource: 'workflow',
      actions: ['read', 'execute'],
      conditions: [],
    },
  ],
};

const mockAuthContext = {
  user: mockUser,
  isAuthenticated: true,
  isLoading: false,
  login: jest.fn(),
  logout: jest.fn(),
  refreshToken: jest.fn(),
  completeLogin: jest.fn(),
};

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AuthContext.Provider value={mockAuthContext}>
    {children}
  </AuthContext.Provider>
);

describe('useAuthenticationErrorHandling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle authentication errors with retry', async () => {
    const { result } = renderHook(() => useAuthenticationErrorHandling(), {
      wrapper: AuthProvider,
    });

    const error = createAuthenticationError('Token expired', {
      provider: 'azure',
      authStep: 'refresh',
    });

    const mockOperation = jest.fn().mockResolvedValue('success');
    mockAuthHandlers.AuthenticationErrorHandler.handleAuthenticationError.mockResolvedValue('success');

    await act(async () => {
      const response = await result.current.handleAuthError(
        error,
        mockOperation,
        { provider: 'azure', authStep: 'refresh' }
      );
      expect(response).toBe('success');
    });

    expect(result.current.lastError).toBeNull();
    expect(result.current.retryCount).toBe(0);
    expect(result.current.canRetry).toBe(false);
  });

  it('should update state on error', async () => {
    const onError = jest.fn();
    const { result } = renderHook(() => useAuthenticationErrorHandling({ onError }), {
      wrapper: AuthProvider,
    });

    const error = createAuthenticationError('Login failed', {
      provider: 'github',
      authStep: 'login',
    });

    const mockOperation = jest.fn();
    mockAuthHandlers.AuthenticationErrorHandler.handleAuthenticationError.mockRejectedValue(error);

    await act(async () => {
      try {
        await result.current.handleAuthError(error, mockOperation);
      } catch (e) {
        // Expected to throw
      }
    });

    expect(onError).toHaveBeenCalledWith(error);
    expect(result.current.lastError).toEqual(error);
    expect(result.current.retryCount).toBe(1);
  });

  it('should logout on session expired error', async () => {
    const { result } = renderHook(() => useAuthenticationErrorHandling(), {
      wrapper: AuthProvider,
    });

    const error = createAuthenticationError('Authentication session expired', {
      code: 'AUTH_SESSION_EXPIRED',
      authStep: 'refresh',
    });

    const mockOperation = jest.fn();
    mockAuthHandlers.AuthenticationErrorHandler.handleAuthenticationError.mockRejectedValue(error);

    await act(async () => {
      try {
        await result.current.handleAuthError(error, mockOperation);
      } catch (e) {
        // Expected to throw
      }
    });

    expect(mockAuthContext.logout).toHaveBeenCalled();
  });

  it('should support retry functionality', async () => {
    const { result } = renderHook(() => useAuthenticationErrorHandling(), {
      wrapper: AuthProvider,
    });

    const error = createAuthenticationError('Token expired', {
      provider: 'azure',
      authStep: 'refresh',
    });

    const mockOperation = jest.fn().mockResolvedValue('retry-success');
    
    // First call fails, sets up retry state
    mockAuthHandlers.AuthenticationErrorHandler.handleAuthenticationError
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('retry-success');

    // Initial error
    await act(async () => {
      try {
        await result.current.handleAuthError(error, mockOperation);
      } catch (e) {
        // Expected to throw
      }
    });

    expect(result.current.canRetry).toBe(true);

    // Retry
    await act(async () => {
      const response = await result.current.retry(mockOperation);
      expect(response).toBe('retry-success');
    });

    expect(result.current.canRetry).toBe(false);
  });
});

describe('useAuthorizationErrorHandling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle authorization errors', async () => {
    const onError = jest.fn();
    const { result } = renderHook(() => useAuthorizationErrorHandling({ onError }), {
      wrapper: AuthProvider,
    });

    const error = createAuthorizationError('Access denied', {
      resource: 'workflow',
      action: 'execute',
    });

    mockAuthHandlers.AuthorizationErrorHandler.handleAuthorizationError.mockRejectedValue(error);

    await act(async () => {
      try {
        await result.current.handleAuthzError(error, {
          resource: 'workflow',
          action: 'execute',
        });
      } catch (e) {
        // Expected to throw
      }
    });

    expect(onError).toHaveBeenCalledWith(error);
    expect(result.current.lastError).toEqual(error);
    expect(result.current.canRetry).toBe(false); // Authorization errors are not retryable
  });

  it('should include user permissions in context', async () => {
    const { result } = renderHook(() => useAuthorizationErrorHandling(), {
      wrapper: AuthProvider,
    });

    const error = createAuthorizationError('Access denied', {
      resource: 'admin',
      action: 'access',
    });

    mockAuthHandlers.AuthorizationErrorHandler.handleAuthorizationError.mockRejectedValue(error);

    await act(async () => {
      try {
        await result.current.handleAuthzError(error, {
          resource: 'admin',
          action: 'access',
        });
      } catch (e) {
        // Expected to throw
      }
    });

    expect(mockAuthHandlers.AuthorizationErrorHandler.handleAuthorizationError).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        userPermissions: ['workflow:read,execute'],
      })
    );
  });
});

describe('useNetworkErrorHandling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle network errors with retry', async () => {
    const onRetrySuccess = jest.fn();
    const { result } = renderHook(() => useNetworkErrorHandling({ onRetrySuccess }), {
      wrapper: AuthProvider,
    });

    const error = createNetworkError('Server error', {
      status: 500,
      endpoint: '/api/test',
    });

    const mockOperation = jest.fn().mockResolvedValue('success');
    mockAuthHandlers.NetworkErrorHandler.handleNetworkError.mockResolvedValue('success');

    await act(async () => {
      const response = await result.current.handleNetworkError(
        error,
        mockOperation,
        { endpoint: '/api/test' }
      );
      expect(response).toBe('success');
    });

    expect(onRetrySuccess).toHaveBeenCalled();
    expect(result.current.lastError).toBeNull();
    expect(result.current.retryCount).toBe(0);
  });

  it('should update retry state on failure', async () => {
    const onRetryFailure = jest.fn();
    const { result } = renderHook(() => useNetworkErrorHandling({ onRetryFailure }), {
      wrapper: AuthProvider,
    });

    const error = createNetworkError('Server error', {
      status: 500,
      endpoint: '/api/test',
      retryCount: 1,
    });

    const mockOperation = jest.fn();
    mockAuthHandlers.NetworkErrorHandler.handleNetworkError.mockRejectedValue(error);

    await act(async () => {
      try {
        await result.current.handleNetworkError(error, mockOperation);
      } catch (e) {
        // Expected to throw
      }
    });

    expect(onRetryFailure).toHaveBeenCalledWith(error);
    expect(result.current.lastError).toEqual(error);
    expect(result.current.retryCount).toBe(1);
    expect(result.current.canRetry).toBe(true); // Should be retryable if under max retries
  });

  it('should support retry functionality', async () => {
    const { result } = renderHook(() => useNetworkErrorHandling(), {
      wrapper: AuthProvider,
    });

    const error = createNetworkError('Server error', {
      status: 500,
      endpoint: '/api/test',
    });

    const mockOperation = jest.fn().mockResolvedValue('retry-success');
    
    // First call fails, sets up retry state
    mockAuthHandlers.NetworkErrorHandler.handleNetworkError
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('retry-success');

    // Initial error
    await act(async () => {
      try {
        await result.current.handleNetworkError(error, mockOperation);
      } catch (e) {
        // Expected to throw
      }
    });

    expect(result.current.canRetry).toBe(true);

    // Retry
    await act(async () => {
      const response = await result.current.retry(mockOperation);
      expect(response).toBe('retry-success');
    });

    expect(result.current.canRetry).toBe(false);
  });
});

describe('useDifyApiErrorHandling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle Dify API errors with retry', async () => {
    const onRetrySuccess = jest.fn();
    const { result } = renderHook(() => useDifyApiErrorHandling({ onRetrySuccess }), {
      wrapper: AuthProvider,
    });

    const error = createDifyApiError('Workflow busy', {
      workflowId: 'workflow-1',
      apiErrorCode: 'WORKFLOW_BUSY',
    });

    const mockOperation = jest.fn().mockResolvedValue('success');
    mockAuthHandlers.DifyApiErrorHandler.handleDifyApiError.mockResolvedValue('success');

    await act(async () => {
      const response = await result.current.handleDifyError(
        error,
        mockOperation,
        { workflowId: 'workflow-1', workflowName: 'Test Workflow' }
      );
      expect(response).toBe('success');
    });

    expect(onRetrySuccess).toHaveBeenCalled();
    expect(result.current.lastError).toBeNull();
    expect(result.current.retryCount).toBe(0);
  });

  it('should handle non-retryable Dify errors', async () => {
    const onRetryFailure = jest.fn();
    const { result } = renderHook(() => useDifyApiErrorHandling({ onRetryFailure }), {
      wrapper: AuthProvider,
    });

    const error = createDifyApiError('Invalid input', {
      workflowId: 'workflow-1',
      apiErrorCode: 'INVALID_INPUT',
      details: { retryCount: 5 }, // Over max retries
    });

    const mockOperation = jest.fn();
    mockAuthHandlers.DifyApiErrorHandler.handleDifyApiError.mockRejectedValue(error);

    await act(async () => {
      try {
        await result.current.handleDifyError(error, mockOperation);
      } catch (e) {
        // Expected to throw
      }
    });

    expect(onRetryFailure).toHaveBeenCalledWith(error);
    expect(result.current.lastError).toEqual(error);
    expect(result.current.canRetry).toBe(false); // Over max retries
  });
});

describe('useUnifiedErrorHandling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle any error type', async () => {
    const { result } = renderHook(() => useUnifiedErrorHandling(), {
      wrapper: AuthProvider,
    });

    const error = createNetworkError('Server error', {
      status: 500,
      endpoint: '/api/test',
    });

    const mockOperation = jest.fn().mockResolvedValue('success');
    mockAuthHandlers.UnifiedErrorHandler.handleError.mockResolvedValue('success');

    await act(async () => {
      const response = await result.current.handleError(error, mockOperation);
      expect(response).toBe('success');
    });

    expect(result.current.lastError).toBeNull();
    expect(result.current.retryCount).toBe(0);
  });

  it('should provide access to individual error states', async () => {
    const { result } = renderHook(() => useUnifiedErrorHandling(), {
      wrapper: AuthProvider,
    });

    const authError = createAuthenticationError('Auth error', {
      authStep: 'login',
    });

    const mockOperation = jest.fn();
    mockAuthHandlers.UnifiedErrorHandler.handleError.mockRejectedValue(authError);

    await act(async () => {
      try {
        await result.current.handleError(authError, mockOperation);
      } catch (e) {
        // Expected to throw
      }
    });

    expect(result.current.lastError).toEqual(authError);
  });

  it('should clear error state', async () => {
    const { result } = renderHook(() => useUnifiedErrorHandling(), {
      wrapper: AuthProvider,
    });

    const error = createNetworkError('Server error', {
      status: 500,
    });

    const mockOperation = jest.fn();
    mockAuthHandlers.UnifiedErrorHandler.handleError.mockRejectedValue(error);

    // Set error state
    await act(async () => {
      try {
        await result.current.handleError(error, mockOperation);
      } catch (e) {
        // Expected to throw
      }
    });

    expect(result.current.lastError).toEqual(error);

    // Clear error state
    act(() => {
      result.current.clearError();
    });

    expect(result.current.lastError).toBeNull();
    expect(result.current.retryCount).toBe(0);
  });
});

describe('useAsyncWithErrorHandling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should execute async function successfully', async () => {
    const asyncFunction = jest.fn().mockResolvedValue('success');
    const { result } = renderHook(() => useAsyncWithErrorHandling(asyncFunction), {
      wrapper: AuthProvider,
    });

    await act(async () => {
      const response = await result.current.execute('arg1', 'arg2');
      expect(response).toBe('success');
    });

    expect(asyncFunction).toHaveBeenCalledWith('arg1', 'arg2');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle errors and provide retry functionality', async () => {
    const error = createNetworkError('Server error', {
      status: 500,
    });

    const asyncFunction = jest.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue('retry-success');

    mockAuthHandlers.UnifiedErrorHandler.handleError
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('retry-success');

    const { result } = renderHook(() => useAsyncWithErrorHandling(asyncFunction), {
      wrapper: AuthProvider,
    });

    // Initial execution fails
    await act(async () => {
      try {
        await result.current.execute('arg1');
      } catch (e) {
        // Expected to throw
      }
    });

    expect(result.current.error).toEqual(error);
    expect(result.current.canRetry).toBe(true);

    // Retry succeeds
    await act(async () => {
      const response = await result.current.retry();
      expect(response).toBe('retry-success');
    });

    expect(result.current.error).toBeNull();
  });

  it('should manage loading state correctly', async () => {
    const asyncFunction = jest.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve('success'), 100))
    );

    const { result } = renderHook(() => useAsyncWithErrorHandling(asyncFunction), {
      wrapper: AuthProvider,
    });

    expect(result.current.isLoading).toBe(false);

    // Start execution
    act(() => {
      result.current.execute();
    });

    expect(result.current.isLoading).toBe(true);

    // Wait for completion
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('should clear error state', async () => {
    const error = createNetworkError('Server error', {
      status: 500,
    });

    const asyncFunction = jest.fn().mockRejectedValue(error);
    mockAuthHandlers.UnifiedErrorHandler.handleError.mockRejectedValue(error);

    const { result } = renderHook(() => useAsyncWithErrorHandling(asyncFunction), {
      wrapper: AuthProvider,
    });

    // Execute and get error
    await act(async () => {
      try {
        await result.current.execute();
      } catch (e) {
        // Expected to throw
      }
    });

    expect(result.current.error).toEqual(error);

    // Clear error
    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });
});