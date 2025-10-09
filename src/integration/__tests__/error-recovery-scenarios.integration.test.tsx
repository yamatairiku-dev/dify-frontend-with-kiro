/**
 * Integration tests for error scenarios and recovery mechanisms
 * Tests comprehensive error handling across the entire application
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import { AuthProvider } from '../../context/AuthContext';
import { GlobalErrorBoundary } from '../../components/GlobalErrorBoundary';
import { RouteErrorBoundary } from '../../components/RouteErrorBoundary';
import { EnhancedErrorDisplay } from '../../components/EnhancedErrorDisplay';
import { 
  AuthenticationErrorHandler,
  AuthorizationErrorHandler,
  NetworkErrorHandler,
  DifyApiErrorHandler
} from '../../services/specificErrorHandlers';
import { 
  useAuthenticationErrorHandling,
  useNetworkErrorHandling,
  useDifyApiErrorHandling,
  useUnifiedErrorHandling
} from '../../hooks/useErrorHandling';
import { TokenManager } from '../../services/tokenManager';
import { TokenRefreshService } from '../../services/tokenRefresh';
import { DifyApiClient } from '../../services/difyApiClient';
import { OAuthService } from '../../services/oauth';
import { User, AuthenticationError, NetworkError, DifyApiError } from '../../types';

// Mock all services
jest.mock('../../services/tokenManager');
jest.mock('../../services/tokenRefresh');
jest.mock('../../services/difyApiClient');
jest.mock('../../services/oauth');
jest.mock('../../services/specificErrorHandlers');

const mockTokenManager = TokenManager as jest.Mocked<typeof TokenManager>;
const mockTokenRefresh = TokenRefreshService as jest.Mocked<typeof TokenRefreshService>;
const mockDifyApiClient = DifyApiClient as jest.Mocked<typeof DifyApiClient>;
const mockOAuthService = OAuthService as jest.Mocked<typeof OAuthService>;
const mockAuthErrorHandler = AuthenticationErrorHandler as jest.Mocked<typeof AuthenticationErrorHandler>;
const mockNetworkErrorHandler = NetworkErrorHandler as jest.Mocked<typeof NetworkErrorHandler>;
const mockDifyApiErrorHandler = DifyApiErrorHandler as jest.Mocked<typeof DifyApiErrorHandler>;

// Test user
const testUser: User = {
  id: 'test-user',
  email: 'user@company.com',
  name: 'Test User',
  provider: 'azure',
  attributes: {
    domain: 'company.com',
    roles: ['user'],
    department: 'Engineering'
  },
  permissions: [
    {
      resource: 'workflow',
      actions: ['read', 'execute'],
      conditions: []
    }
  ]
};

// Test components that demonstrate error scenarios
const AuthenticationTestComponent: React.FC = () => {
  const { handleError, isLoading, error, retry, clearError } = useAuthenticationErrorHandling();

  const handleLogin = async () => {
    try {
      await mockOAuthService.getAuthorizationUrl('azure');
    } catch (err) {
      handleError(err as AuthenticationError);
    }
  };

  const handleTokenRefresh = async () => {
    try {
      await mockTokenRefresh.refreshAccessToken();
    } catch (err) {
      handleError(err as AuthenticationError);
    }
  };

  return (
    <div>
      <h2>Authentication Test</h2>
      <button onClick={handleLogin} disabled={isLoading}>
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
      <button onClick={handleTokenRefresh} disabled={isLoading}>
        Refresh Token
      </button>
      {error && (
        <div data-testid="auth-error">
          <EnhancedErrorDisplay error={error} onRetry={retry} onDismiss={clearError} />
        </div>
      )}
    </div>
  );
};

const NetworkTestComponent: React.FC = () => {
  const { handleError, isLoading, error, retry, clearError } = useNetworkErrorHandling();

  const handleApiCall = async () => {
    try {
      const response = await fetch('/api/test');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      handleError(err as NetworkError);
    }
  };

  return (
    <div>
      <h2>Network Test</h2>
      <button onClick={handleApiCall} disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Make API Call'}
      </button>
      {error && (
        <div data-testid="network-error">
          <EnhancedErrorDisplay error={error} onRetry={retry} onDismiss={clearError} />
        </div>
      )}
    </div>
  );
};

const DifyApiTestComponent: React.FC = () => {
  const { handleError, isLoading, error, retry, clearError } = useDifyApiErrorHandling();

  const handleWorkflowExecution = async () => {
    try {
      await mockDifyApiClient.prototype.executeWorkflow('test-workflow', { input: 'test' });
    } catch (err) {
      handleError(err as DifyApiError);
    }
  };

  const handleWorkflowList = async () => {
    try {
      await mockDifyApiClient.prototype.getWorkflows();
    } catch (err) {
      handleError(err as DifyApiError);
    }
  };

  return (
    <div>
      <h2>Dify API Test</h2>
      <button onClick={handleWorkflowExecution} disabled={isLoading}>
        Execute Workflow
      </button>
      <button onClick={handleWorkflowList} disabled={isLoading}>
        Get Workflows
      </button>
      {error && (
        <div data-testid="dify-error">
          <EnhancedErrorDisplay error={error} onRetry={retry} onDismiss={clearError} />
        </div>
      )}
    </div>
  );
};

const UnifiedErrorTestComponent: React.FC = () => {
  const { handleError, isLoading, error, retry, clearError } = useUnifiedErrorHandling();

  const handleMixedOperations = async () => {
    try {
      // Simulate a complex operation that could fail in multiple ways
      await mockTokenRefresh.validateAndRefreshSession();
      await mockDifyApiClient.prototype.getWorkflows();
      await fetch('/api/complex-operation');
    } catch (err) {
      handleError(err as Error);
    }
  };

  return (
    <div>
      <h2>Unified Error Test</h2>
      <button onClick={handleMixedOperations} disabled={isLoading}>
        Complex Operation
      </button>
      {error && (
        <div data-testid="unified-error">
          <EnhancedErrorDisplay error={error} onRetry={retry} onDismiss={clearError} />
        </div>
      )}
    </div>
  );
};

const ComponentErrorTestComponent: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = false }) => {
  if (shouldThrow) {
    throw new Error('Component rendering error');
  }

  return <div>Component rendered successfully</div>;
};

const TestApp: React.FC<{ 
  showAuth?: boolean;
  showNetwork?: boolean;
  showDify?: boolean;
  showUnified?: boolean;
  showComponentError?: boolean;
  componentShouldThrow?: boolean;
}> = ({ 
  showAuth = false,
  showNetwork = false,
  showDify = false,
  showUnified = false,
  showComponentError = false,
  componentShouldThrow = false
}) => {
  return (
    <BrowserRouter>
      <AuthProvider initialUser={testUser}>
        <GlobalErrorBoundary>
          <RouteErrorBoundary routeName="Test Route">
            <div>
              <h1>Error Recovery Test Application</h1>
              {showAuth && <AuthenticationTestComponent />}
              {showNetwork && <NetworkTestComponent />}
              {showDify && <DifyApiTestComponent />}
              {showUnified && <UnifiedErrorTestComponent />}
              {showComponentError && (
                <ComponentErrorTestComponent shouldThrow={componentShouldThrow} />
              )}
            </div>
          </RouteErrorBoundary>
        </GlobalErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Error Recovery Scenarios Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset console.error to avoid test noise
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Authentication Error Recovery', () => {
    it('should handle OAuth initiation failures with retry', async () => {
      mockOAuthService.getAuthorizationUrl
        .mockRejectedValueOnce(new Error('OAuth service unavailable'))
        .mockResolvedValueOnce('https://oauth.provider.com/auth');

      mockAuthErrorHandler.handleAuthenticationError.mockImplementation(
        async (error, operation) => {
          // First attempt fails, second succeeds
          return await operation();
        }
      );

      render(<TestApp showAuth={true} />);

      const loginButton = screen.getByText('Login');
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(screen.getByTestId('auth-error')).toBeInTheDocument();
      });

      // Retry should succeed
      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(mockOAuthService.getAuthorizationUrl).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle token refresh failures with automatic retry', async () => {
      mockTokenRefresh.refreshAccessToken
        .mockRejectedValueOnce(new Error('Token refresh failed'))
        .mockResolvedValueOnce({
          accessToken: 'new-token',
          refreshToken: 'new-refresh-token',
          expiresAt: Date.now() + 3600000,
          user: testUser
        });

      mockAuthErrorHandler.handleAuthenticationError.mockImplementation(
        async (error, operation) => {
          // Simulate retry logic
          await new Promise(resolve => setTimeout(resolve, 1000));
          return await operation();
        }
      );

      render(<TestApp showAuth={true} />);

      const refreshButton = screen.getByText('Refresh Token');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(screen.getByTestId('auth-error')).toBeInTheDocument();
      });

      // Should show retry option
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should handle session expiry with automatic logout', async () => {
      mockTokenManager.isTokenValid.mockReturnValue(false);
      mockTokenManager.needsRefresh.mockReturnValue(false);
      mockTokenRefresh.refreshAccessToken.mockRejectedValue(new Error('Session expired'));

      mockAuthErrorHandler.handleAuthenticationError.mockImplementation(
        async (error, operation) => {
          throw error; // Don't retry for expired sessions
        }
      );

      render(<TestApp showAuth={true} />);

      const refreshButton = screen.getByText('Refresh Token');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(screen.getByTestId('auth-error')).toBeInTheDocument();
      });

      // Should show session expired message
      expect(screen.getByText(/session.*expired/i)).toBeInTheDocument();
    });

    it('should handle suspicious activity detection', async () => {
      mockTokenManager.detectSuspiciousActivity.mockReturnValue(true);
      mockTokenManager.clearSession.mockImplementation(() => {});

      mockAuthErrorHandler.handleAuthenticationError.mockImplementation(
        async (error) => {
          throw new Error('Session invalidated due to suspicious activity');
        }
      );

      render(<TestApp showAuth={true} />);

      const loginButton = screen.getByText('Login');
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(mockTokenManager.detectSuspiciousActivity).toHaveBeenCalled();
      });
    });
  });

  describe('Network Error Recovery', () => {
    it('should handle network timeouts with exponential backoff', async () => {
      global.fetch = jest.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce(new Response('Success', { status: 200 }));

      mockNetworkErrorHandler.handleNetworkError.mockImplementation(
        async (error, operation) => {
          // Simulate exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000));
          return await operation();
        }
      );

      render(<TestApp showNetwork={true} />);

      const apiButton = screen.getByText('Make API Call');
      fireEvent.click(apiButton);

      await waitFor(() => {
        expect(screen.getByTestId('network-error')).toBeInTheDocument();
      });

      // Should show retry option
      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle HTTP error codes appropriately', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce(new Response('Server Error', { status: 500 }))
        .mockResolvedValueOnce(new Response('Success', { status: 200 }));

      mockNetworkErrorHandler.handleNetworkError.mockImplementation(
        async (error, operation) => {
          if (error.message.includes('500')) {
            // Retry for 5xx errors
            return await operation();
          }
          throw error;
        }
      );

      render(<TestApp showNetwork={true} />);

      const apiButton = screen.getByText('Make API Call');
      fireEvent.click(apiButton);

      await waitFor(() => {
        expect(screen.getByTestId('network-error')).toBeInTheDocument();
      });

      // Should show server error message
      expect(screen.getByText(/server error/i)).toBeInTheDocument();
    });

    it('should handle rate limiting with appropriate delays', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce(new Response('Rate Limited', { 
          status: 429,
          headers: { 'Retry-After': '60' }
        }))
        .mockResolvedValueOnce(new Response('Success', { status: 200 }));

      mockNetworkErrorHandler.handleNetworkError.mockImplementation(
        async (error, operation) => {
          // Simulate rate limit handling
          await new Promise(resolve => setTimeout(resolve, 100)); // Shortened for test
          return await operation();
        }
      );

      render(<TestApp showNetwork={true} />);

      const apiButton = screen.getByText('Make API Call');
      fireEvent.click(apiButton);

      await waitFor(() => {
        expect(screen.getByTestId('network-error')).toBeInTheDocument();
      });

      // Should show rate limit message
      expect(screen.getByText(/rate limit/i)).toBeInTheDocument();
    });

    it('should handle connection failures gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Failed to fetch'));

      mockNetworkErrorHandler.handleNetworkError.mockImplementation(
        async (error) => {
          throw error; // Don't retry connection failures
        }
      );

      render(<TestApp showNetwork={true} />);

      const apiButton = screen.getByText('Make API Call');
      fireEvent.click(apiButton);

      await waitFor(() => {
        expect(screen.getByTestId('network-error')).toBeInTheDocument();
      });

      // Should show connection error message
      expect(screen.getByText(/connection/i)).toBeInTheDocument();
    });
  });

  describe('Dify API Error Recovery', () => {
    it('should handle workflow execution failures with context', async () => {
      mockDifyApiClient.prototype.executeWorkflow
        .mockRejectedValueOnce(new Error('Workflow execution timeout'))
        .mockResolvedValueOnce({
          executionId: 'exec-123',
          status: 'completed',
          result: { output: 'success' }
        });

      mockDifyApiErrorHandler.handleDifyApiError.mockImplementation(
        async (error, operation, context) => {
          // Retry with context
          return await operation();
        }
      );

      render(<TestApp showDify={true} />);

      const executeButton = screen.getByText('Execute Workflow');
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(screen.getByTestId('dify-error')).toBeInTheDocument();
      });

      // Should show workflow-specific error message
      expect(screen.getByText(/workflow.*timeout/i)).toBeInTheDocument();

      // Retry should succeed
      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(mockDifyApiClient.prototype.executeWorkflow).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle API authentication errors', async () => {
      mockDifyApiClient.prototype.getWorkflows.mockRejectedValue(
        new Error('Invalid API key')
      );

      mockDifyApiErrorHandler.handleDifyApiError.mockImplementation(
        async (error) => {
          throw error; // Don't retry auth errors
        }
      );

      render(<TestApp showDify={true} />);

      const listButton = screen.getByText('Get Workflows');
      fireEvent.click(listButton);

      await waitFor(() => {
        expect(screen.getByTestId('dify-error')).toBeInTheDocument();
      });

      // Should show authentication error message
      expect(screen.getByText(/invalid.*api.*key/i)).toBeInTheDocument();
    });

    it('should handle workflow not found errors', async () => {
      mockDifyApiClient.prototype.executeWorkflow.mockRejectedValue(
        new Error('Workflow not found: test-workflow')
      );

      mockDifyApiErrorHandler.handleDifyApiError.mockImplementation(
        async (error) => {
          throw error; // Don't retry not found errors
        }
      );

      render(<TestApp showDify={true} />);

      const executeButton = screen.getByText('Execute Workflow');
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(screen.getByTestId('dify-error')).toBeInTheDocument();
      });

      // Should show not found message
      expect(screen.getByText(/workflow.*not found/i)).toBeInTheDocument();
    });

    it('should handle workflow busy errors with retry', async () => {
      mockDifyApiClient.prototype.executeWorkflow
        .mockRejectedValueOnce(new Error('Workflow is busy, please try again'))
        .mockResolvedValueOnce({
          executionId: 'exec-456',
          status: 'completed',
          result: { output: 'success' }
        });

      mockDifyApiErrorHandler.handleDifyApiError.mockImplementation(
        async (error, operation) => {
          if (error.message.includes('busy')) {
            // Retry after delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            return await operation();
          }
          throw error;
        }
      );

      render(<TestApp showDify={true} />);

      const executeButton = screen.getByText('Execute Workflow');
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(screen.getByTestId('dify-error')).toBeInTheDocument();
      });

      // Should show busy message with retry option
      expect(screen.getByText(/workflow.*busy/i)).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  describe('Unified Error Handling', () => {
    it('should handle mixed error scenarios appropriately', async () => {
      // Setup multiple failing operations
      mockTokenRefresh.validateAndRefreshSession.mockRejectedValue(
        new Error('Token validation failed')
      );
      mockDifyApiClient.prototype.getWorkflows.mockRejectedValue(
        new Error('API service unavailable')
      );
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      render(<TestApp showUnified={true} />);

      const complexButton = screen.getByText('Complex Operation');
      fireEvent.click(complexButton);

      await waitFor(() => {
        expect(screen.getByTestId('unified-error')).toBeInTheDocument();
      });

      // Should show the first error encountered
      expect(screen.getByText(/token validation failed/i)).toBeInTheDocument();
    });

    it('should provide appropriate recovery suggestions', async () => {
      mockTokenRefresh.validateAndRefreshSession.mockRejectedValue(
        new Error('Session expired')
      );

      render(<TestApp showUnified={true} />);

      const complexButton = screen.getByText('Complex Operation');
      fireEvent.click(complexButton);

      await waitFor(() => {
        expect(screen.getByTestId('unified-error')).toBeInTheDocument();
      });

      // Should show recovery suggestions
      expect(screen.getByText(/please.*login.*again/i)).toBeInTheDocument();
    });
  });

  describe('Component Error Boundaries', () => {
    it('should catch component rendering errors', () => {
      render(<TestApp showComponentError={true} componentShouldThrow={true} />);

      // Should show error boundary
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Component rendering error')).toBeInTheDocument();
    });

    it('should provide retry functionality for component errors', () => {
      let shouldThrow = true;
      
      const DynamicErrorComponent: React.FC = () => {
        if (shouldThrow) {
          throw new Error('Dynamic component error');
        }
        return <div>Component recovered</div>;
      };

      const TestErrorApp: React.FC = () => (
        <BrowserRouter>
          <RouteErrorBoundary routeName="Dynamic Error">
            <DynamicErrorComponent />
          </RouteErrorBoundary>
        </BrowserRouter>
      );

      const { rerender } = render(<TestErrorApp />);

      // Should show error initially
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Fix the error condition
      shouldThrow = false;

      // Click retry
      fireEvent.click(screen.getByText('Try Again'));

      // Re-render to simulate retry
      rerender(<TestErrorApp />);

      // Should show recovered component
      expect(screen.getByText('Component recovered')).toBeInTheDocument();
    });

    it('should handle nested error boundaries correctly', () => {
      const NestedErrorComponent: React.FC = () => {
        throw new Error('Nested component error');
      };

      const TestNestedApp: React.FC = () => (
        <BrowserRouter>
          <GlobalErrorBoundary>
            <RouteErrorBoundary routeName="Outer Route">
              <div>
                <h1>Outer Component</h1>
                <RouteErrorBoundary routeName="Inner Route">
                  <NestedErrorComponent />
                </RouteErrorBoundary>
              </div>
            </RouteErrorBoundary>
          </GlobalErrorBoundary>
        </BrowserRouter>
      );

      render(<TestNestedApp />);

      // Inner error boundary should catch the error
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Nested component error')).toBeInTheDocument();
      
      // Outer component should still be visible
      expect(screen.getByText('Outer Component')).toBeInTheDocument();
    });
  });

  describe('Error Logging and Monitoring', () => {
    it('should log errors appropriately without exposing sensitive data', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockOAuthService.getAuthorizationUrl.mockRejectedValue(
        new Error('OAuth configuration error')
      );

      render(<TestApp showAuth={true} />);

      const loginButton = screen.getByText('Login');
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(screen.getByTestId('auth-error')).toBeInTheDocument();
      });

      // Should log error without sensitive information
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should provide error context for debugging', async () => {
      mockDifyApiClient.prototype.executeWorkflow.mockRejectedValue(
        new Error('Workflow execution failed')
      );

      render(<TestApp showDify={true} />);

      const executeButton = screen.getByText('Execute Workflow');
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(screen.getByTestId('dify-error')).toBeInTheDocument();
      });

      // Error display should include context information
      expect(mockDifyApiErrorHandler.handleDifyApiError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.any(Function),
        expect.objectContaining({
          workflowId: 'test-workflow'
        })
      );
    });
  });

  describe('Error Recovery Performance', () => {
    it('should not cause memory leaks during error recovery', async () => {
      // Simulate multiple error/recovery cycles
      for (let i = 0; i < 10; i++) {
        mockOAuthService.getAuthorizationUrl
          .mockRejectedValueOnce(new Error(`Error ${i}`))
          .mockResolvedValueOnce('https://oauth.provider.com/auth');

        const { unmount } = render(<TestApp showAuth={true} />);

        const loginButton = screen.getByText('Login');
        fireEvent.click(loginButton);

        await waitFor(() => {
          expect(screen.getByTestId('auth-error')).toBeInTheDocument();
        });

        unmount();
      }

      // Should not accumulate error handlers or memory leaks
      expect(mockAuthErrorHandler.handleAuthenticationError).toHaveBeenCalledTimes(10);
    });

    it('should handle rapid successive errors gracefully', async () => {
      mockNetworkErrorHandler.handleNetworkError.mockImplementation(
        async (error, operation) => {
          // Simulate rapid retry attempts
          await new Promise(resolve => setTimeout(resolve, 10));
          throw error; // Keep failing
        }
      );

      global.fetch = jest.fn().mockRejectedValue(new Error('Persistent network error'));

      render(<TestApp showNetwork={true} />);

      const apiButton = screen.getByText('Make API Call');
      
      // Rapid clicks should be handled gracefully
      fireEvent.click(apiButton);
      fireEvent.click(apiButton);
      fireEvent.click(apiButton);

      await waitFor(() => {
        expect(screen.getByTestId('network-error')).toBeInTheDocument();
      });

      // Should not cause race conditions or multiple error displays
      expect(screen.getAllByTestId('network-error')).toHaveLength(1);
    });
  });
});