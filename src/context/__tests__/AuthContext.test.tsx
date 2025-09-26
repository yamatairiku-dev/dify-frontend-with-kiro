import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { initiateOAuthLogin } from '../../utils/oauth-redirect';
import { TokenManager } from '../../services/tokenManager';
import { TokenRefreshService } from '../../services/tokenRefresh';
import { SessionData, User } from '../../types/auth';

// Mock the oauth-redirect utility
jest.mock('../../utils/oauth-redirect');
const mockInitiateOAuthLogin = initiateOAuthLogin as jest.MockedFunction<typeof initiateOAuthLogin>;

// Mock token management services
jest.mock('../../services/tokenManager');
jest.mock('../../services/tokenRefresh');
const mockTokenManager = TokenManager as jest.Mocked<typeof TokenManager>;
const mockTokenRefreshService = TokenRefreshService as jest.Mocked<typeof TokenRefreshService>;

// Mock user data
const mockUser: User = {
  id: 'user123',
  email: 'test@example.com',
  name: 'Test User',
  provider: 'github',
  attributes: {
    domain: 'example.com',
    roles: ['user'],
  },
  permissions: [],
};

const mockSessionData: SessionData = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresAt: Date.now() + 3600000,
  user: mockUser,
};

// Test component that uses the auth context
const TestComponent: React.FC = () => {
  const { user, isAuthenticated, isLoading, login, logout, refreshToken, completeLogin } = useAuth();

  const handleLogin = async () => {
    try {
      await login('github');
    } catch (error) {
      console.log('Login failed:', error);
    }
  };

  const handleCompleteLogin = async () => {
    try {
      await completeLogin(mockSessionData);
    } catch (error) {
      console.log('Complete login failed:', error);
    }
  };

  const handleRefreshToken = async () => {
    try {
      await refreshToken();
    } catch (error) {
      console.log('Token refresh failed:', error);
    }
  };

  return (
    <div>
      <div data-testid="user">{user ? user.email : 'No user'}</div>
      <div data-testid="authenticated">{isAuthenticated.toString()}</div>
      <div data-testid="loading">{isLoading.toString()}</div>
      <button onClick={handleLogin} data-testid="login-btn">
        Login
      </button>
      <button onClick={() => logout()} data-testid="logout-btn">
        Logout
      </button>
      <button onClick={handleCompleteLogin} data-testid="complete-login-btn">
        Complete Login
      </button>
      <button onClick={handleRefreshToken} data-testid="refresh-token-btn">
        Refresh Token
      </button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockTokenRefreshService.validateAndRefreshSession.mockResolvedValue({
      isValid: false,
      user: null,
    });
    mockTokenRefreshService.setupAutoRefresh.mockImplementation(() => {});
    mockTokenRefreshService.clearAutoRefresh.mockImplementation(() => {});
    mockTokenManager.storeSession.mockImplementation(() => {});
    mockTokenManager.clearSession.mockImplementation(() => {});
  });

  it('should provide initial authentication state', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for initialization to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('No user');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
  });

  it('should restore valid session on initialization', async () => {
    mockTokenRefreshService.validateAndRefreshSession.mockResolvedValue({
      isValid: true,
      user: mockUser,
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(mockTokenRefreshService.setupAutoRefresh).toHaveBeenCalled();
  });

  it('should throw error when useAuth is used outside AuthProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleSpy.mockRestore();
  });

  it('should handle OAuth login initiation', async () => {
    mockInitiateOAuthLogin.mockResolvedValue();

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const loginBtn = screen.getByTestId('login-btn');

    await act(async () => {
      loginBtn.click();
    });

    expect(mockInitiateOAuthLogin).toHaveBeenCalledWith('github');
  });

  it('should handle login failure', async () => {
    mockInitiateOAuthLogin.mockRejectedValue(new Error('OAuth failed'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const loginBtn = screen.getByTestId('login-btn');

    await act(async () => {
      loginBtn.click();
    });

    // Should show loading state during login attempt
    expect(mockInitiateOAuthLogin).toHaveBeenCalled();
  });

  it('should complete login successfully', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    const completeLoginBtn = screen.getByTestId('complete-login-btn');

    await act(async () => {
      completeLoginBtn.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    });

    expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    expect(mockTokenManager.storeSession).toHaveBeenCalledWith(mockSessionData);
    expect(mockTokenRefreshService.setupAutoRefresh).toHaveBeenCalled();
  });

  it('should handle logout with token cleanup', async () => {
    // Start with authenticated state
    mockTokenRefreshService.validateAndRefreshSession.mockResolvedValue({
      isValid: true,
      user: mockUser,
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    });

    const logoutBtn = screen.getByTestId('logout-btn');

    await act(async () => {
      logoutBtn.click();
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('user')).toHaveTextContent('No user');
    expect(mockTokenRefreshService.clearAutoRefresh).toHaveBeenCalled();
    expect(mockTokenManager.clearSession).toHaveBeenCalled();
  });

  it('should handle token refresh successfully', async () => {
    const refreshedSessionData = {
      ...mockSessionData,
      accessToken: 'new-access-token',
    };

    mockTokenRefreshService.refreshAccessToken.mockResolvedValue(refreshedSessionData);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const refreshBtn = screen.getByTestId('refresh-token-btn');

    await act(async () => {
      refreshBtn.click();
    });

    expect(mockTokenRefreshService.refreshAccessToken).toHaveBeenCalled();
    expect(mockTokenRefreshService.setupAutoRefresh).toHaveBeenCalled();
  });

  it('should handle token refresh failure', async () => {
    mockTokenRefreshService.refreshAccessToken.mockResolvedValue(null);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const refreshBtn = screen.getByTestId('refresh-token-btn');

    await act(async () => {
      refreshBtn.click();
    });

    expect(mockTokenRefreshService.refreshAccessToken).toHaveBeenCalled();
    // Should remain in logged out state
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
  });

  it('should handle initialization errors gracefully', async () => {
    mockTokenRefreshService.validateAndRefreshSession.mockRejectedValue(
      new Error('Initialization failed')
    );

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});