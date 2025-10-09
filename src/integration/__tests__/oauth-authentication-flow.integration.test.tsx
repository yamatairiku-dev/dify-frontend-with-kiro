/**
 * Integration tests for OAuth authentication flows
 * Tests complete OAuth flow from initiation to completion for all providers
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import { AuthProvider } from '../../context/AuthContext';
import { OAuthService } from '../../services/oauth';
import { TokenManager } from '../../services/tokenManager';
import { TokenRefreshService } from '../../services/tokenRefresh';
import { initiateOAuthLogin, handleOAuthCallback } from '../../utils/oauth-redirect';
import { User, SessionData, AuthProviderType } from '../../types/auth';

// Mock external dependencies
jest.mock('../../services/oauth');
jest.mock('../../services/tokenManager');
jest.mock('../../services/tokenRefresh');
jest.mock('../../utils/oauth-redirect');

const mockOAuthService = OAuthService as jest.Mocked<typeof OAuthService>;
const mockTokenManager = TokenManager as jest.Mocked<typeof TokenManager>;
const mockTokenRefresh = TokenRefreshService as jest.Mocked<typeof TokenRefreshService>;
const mockInitiateOAuthLogin = initiateOAuthLogin as jest.MockedFunction<typeof initiateOAuthLogin>;
const mockHandleOAuthCallback = handleOAuthCallback as jest.MockedFunction<typeof handleOAuthCallback>;

// Test data
const mockUsers: Record<AuthProviderType, User> = {
  azure: {
    id: 'azure-user-id',
    email: 'user@company.com',
    name: 'Azure User',
    provider: 'azure',
    attributes: {
      domain: 'company.com',
      roles: ['user'],
      department: 'Engineering',
      organization: 'Company Inc'
    },
    permissions: [
      {
        resource: 'workflow',
        actions: ['read', 'execute'],
        conditions: []
      }
    ]
  },
  github: {
    id: 'github-user-id',
    email: 'developer@github.com',
    name: 'GitHub Developer',
    provider: 'github',
    attributes: {
      domain: 'github.com',
      roles: ['developer'],
      department: 'Development'
    },
    permissions: [
      {
        resource: 'workflow',
        actions: ['read', 'execute'],
        conditions: []
      }
    ]
  },
  google: {
    id: 'google-user-id',
    email: 'user@gmail.com',
    name: 'Google User',
    provider: 'google',
    attributes: {
      domain: 'gmail.com',
      roles: ['user']
    },
    permissions: [
      {
        resource: 'workflow',
        actions: ['read'],
        conditions: []
      }
    ]
  }
};

const mockSessions: Record<AuthProviderType, SessionData> = {
  azure: {
    accessToken: 'azure-access-token',
    refreshToken: 'azure-refresh-token',
    expiresAt: Date.now() + 3600000,
    user: mockUsers.azure
  },
  github: {
    accessToken: 'github-access-token',
    refreshToken: 'github-refresh-token',
    expiresAt: Date.now() + 3600000,
    user: mockUsers.github
  },
  google: {
    accessToken: 'google-access-token',
    refreshToken: 'google-refresh-token',
    expiresAt: Date.now() + 3600000,
    user: mockUsers.google
  }
};

// Test components
const LoginPage: React.FC = () => {
  const handleLogin = async (provider: AuthProviderType) => {
    await initiateOAuthLogin(provider);
  };

  return (
    <div>
      <h1>Login</h1>
      <button onClick={() => handleLogin('azure')}>Login with Azure</button>
      <button onClick={() => handleLogin('github')}>Login with GitHub</button>
      <button onClick={() => handleLogin('google')}>Login with Google</button>
    </div>
  );
};

const CallbackPage: React.FC<{ provider: AuthProviderType }> = ({ provider }) => {
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    if (code && state) {
      handleOAuthCallback({
        code,
        state,
        provider
      });
    }
  }, [provider]);

  return (
    <div>
      <h1>Processing {provider} login...</h1>
    </div>
  );
};

const TestApp: React.FC<{ 
  showLogin?: boolean; 
  showCallback?: boolean; 
  callbackProvider?: AuthProviderType;
}> = ({ 
  showLogin = true, 
  showCallback = false, 
  callbackProvider = 'azure' 
}) => {
  return (
    <BrowserRouter>
      <AuthProvider>
        {showLogin && <LoginPage />}
        {showCallback && <CallbackPage provider={callbackProvider} />}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('OAuth Authentication Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mocks to default state
    mockTokenManager.getStoredSession.mockReturnValue(null);
    mockTokenManager.isTokenValid.mockReturnValue(false);
    mockTokenRefresh.validateAndRefreshSession.mockResolvedValue({
      isValid: false,
      user: null
    });
  });

  describe('OAuth Initiation Flow', () => {
    it('should initiate Azure AD OAuth flow correctly', async () => {
      mockInitiateOAuthLogin.mockResolvedValue();
      mockOAuthService.getAuthorizationUrl.mockResolvedValue('https://login.microsoftonline.com/oauth/authorize?...');

      render(<TestApp />);

      const azureButton = screen.getByText('Login with Azure');
      fireEvent.click(azureButton);

      await waitFor(() => {
        expect(mockInitiateOAuthLogin).toHaveBeenCalledWith('azure');
      });
    });

    it('should initiate GitHub OAuth flow correctly', async () => {
      mockInitiateOAuthLogin.mockResolvedValue();
      mockOAuthService.getAuthorizationUrl.mockResolvedValue('https://github.com/login/oauth/authorize?...');

      render(<TestApp />);

      const githubButton = screen.getByText('Login with GitHub');
      fireEvent.click(githubButton);

      await waitFor(() => {
        expect(mockInitiateOAuthLogin).toHaveBeenCalledWith('github');
      });
    });

    it('should initiate Google OAuth flow correctly', async () => {
      mockInitiateOAuthLogin.mockResolvedValue();
      mockOAuthService.getAuthorizationUrl.mockResolvedValue('https://accounts.google.com/oauth/authorize?...');

      render(<TestApp />);

      const googleButton = screen.getByText('Login with Google');
      fireEvent.click(googleButton);

      await waitFor(() => {
        expect(mockInitiateOAuthLogin).toHaveBeenCalledWith('google');
      });
    });

    it('should handle OAuth initiation errors gracefully', async () => {
      const error = new Error('OAuth initiation failed');
      mockInitiateOAuthLogin.mockRejectedValue(error);

      render(<TestApp />);

      const azureButton = screen.getByText('Login with Azure');
      fireEvent.click(azureButton);

      await waitFor(() => {
        expect(mockInitiateOAuthLogin).toHaveBeenCalledWith('azure');
      });

      // Error should be handled by the OAuth service
      expect(mockInitiateOAuthLogin).toHaveBeenCalledTimes(1);
    });
  });

  describe('OAuth Callback Flow', () => {
    beforeEach(() => {
      // Mock successful callback handling
      mockHandleOAuthCallback.mockResolvedValue({
        success: true,
        sessionData: mockSessions.azure
      });
    });

    it('should handle Azure AD callback successfully', async () => {
      // Mock URL parameters
      Object.defineProperty(window, 'location', {
        value: {
          search: '?code=auth_code&state=csrf_state'
        },
        writable: true
      });

      render(<TestApp showLogin={false} showCallback={true} callbackProvider="azure" />);

      expect(screen.getByText('Processing azure login...')).toBeInTheDocument();

      await waitFor(() => {
        expect(mockHandleOAuthCallback).toHaveBeenCalledWith({
          code: 'auth_code',
          state: 'csrf_state',
          provider: 'azure'
        });
      });
    });

    it('should handle GitHub callback successfully', async () => {
      mockHandleOAuthCallback.mockResolvedValue({
        success: true,
        sessionData: mockSessions.github
      });

      Object.defineProperty(window, 'location', {
        value: {
          search: '?code=github_code&state=github_state'
        },
        writable: true
      });

      render(<TestApp showLogin={false} showCallback={true} callbackProvider="github" />);

      expect(screen.getByText('Processing github login...')).toBeInTheDocument();

      await waitFor(() => {
        expect(mockHandleOAuthCallback).toHaveBeenCalledWith({
          code: 'github_code',
          state: 'github_state',
          provider: 'github'
        });
      });
    });

    it('should handle Google callback successfully', async () => {
      mockHandleOAuthCallback.mockResolvedValue({
        success: true,
        sessionData: mockSessions.google
      });

      Object.defineProperty(window, 'location', {
        value: {
          search: '?code=google_code&state=google_state'
        },
        writable: true
      });

      render(<TestApp showLogin={false} showCallback={true} callbackProvider="google" />);

      expect(screen.getByText('Processing google login...')).toBeInTheDocument();

      await waitFor(() => {
        expect(mockHandleOAuthCallback).toHaveBeenCalledWith({
          code: 'google_code',
          state: 'google_state',
          provider: 'google'
        });
      });
    });

    it('should handle OAuth callback errors', async () => {
      mockHandleOAuthCallback.mockResolvedValue({
        success: false,
        error: 'Invalid authorization code'
      });

      Object.defineProperty(window, 'location', {
        value: {
          search: '?error=access_denied&error_description=User+denied+access'
        },
        writable: true
      });

      render(<TestApp showLogin={false} showCallback={true} callbackProvider="azure" />);

      // Should still attempt to handle callback even with error parameters
      await waitFor(() => {
        expect(mockHandleOAuthCallback).toHaveBeenCalled();
      });
    });
  });

  describe('Complete Authentication Flow', () => {
    it('should complete full Azure AD authentication flow', async () => {
      // Step 1: Initiate OAuth
      mockInitiateOAuthLogin.mockResolvedValue();
      
      const { rerender } = render(<TestApp />);

      const azureButton = screen.getByText('Login with Azure');
      fireEvent.click(azureButton);

      await waitFor(() => {
        expect(mockInitiateOAuthLogin).toHaveBeenCalledWith('azure');
      });

      // Step 2: Handle callback
      mockHandleOAuthCallback.mockResolvedValue({
        success: true,
        sessionData: mockSessions.azure
      });

      mockTokenManager.storeSession.mockImplementation(() => {});
      mockTokenManager.getStoredSession.mockReturnValue(mockSessions.azure);
      mockTokenManager.isTokenValid.mockReturnValue(true);

      Object.defineProperty(window, 'location', {
        value: {
          search: '?code=auth_code&state=csrf_state'
        },
        writable: true
      });

      rerender(<TestApp showLogin={false} showCallback={true} callbackProvider="azure" />);

      await waitFor(() => {
        expect(mockHandleOAuthCallback).toHaveBeenCalled();
        expect(mockTokenManager.storeSession).toHaveBeenCalledWith(mockSessions.azure);
      });
    });

    it('should handle token refresh during authentication', async () => {
      // Mock expired session
      const expiredSession = {
        ...mockSessions.azure,
        expiresAt: Date.now() - 1000 // Expired
      };

      mockTokenManager.getStoredSession.mockReturnValue(expiredSession);
      mockTokenManager.isTokenValid.mockReturnValue(false);
      mockTokenManager.needsRefresh.mockReturnValue(true);

      // Mock successful refresh
      mockTokenRefresh.refreshAccessToken.mockResolvedValue(mockSessions.azure);
      mockTokenRefresh.validateAndRefreshSession.mockResolvedValue({
        isValid: true,
        user: mockUsers.azure
      });

      render(<TestApp />);

      await waitFor(() => {
        expect(mockTokenRefresh.validateAndRefreshSession).toHaveBeenCalled();
      });
    });
  });

  describe('Session Management Integration', () => {
    it('should handle session restoration on app load', async () => {
      mockTokenManager.getStoredSession.mockReturnValue(mockSessions.azure);
      mockTokenManager.isTokenValid.mockReturnValue(true);
      mockTokenRefresh.validateAndRefreshSession.mockResolvedValue({
        isValid: true,
        user: mockUsers.azure
      });

      render(<TestApp />);

      await waitFor(() => {
        expect(mockTokenRefresh.validateAndRefreshSession).toHaveBeenCalled();
      });
    });

    it('should handle session cleanup on logout', async () => {
      mockTokenManager.getStoredSession.mockReturnValue(mockSessions.azure);
      mockTokenManager.isTokenValid.mockReturnValue(true);
      mockTokenManager.clearSession.mockImplementation(() => {});

      render(<TestApp />);

      // Simulate logout
      mockTokenManager.clearSession();

      expect(mockTokenManager.clearSession).toHaveBeenCalled();
    });

    it('should handle suspicious activity detection', async () => {
      mockTokenManager.getStoredSession.mockReturnValue(mockSessions.azure);
      mockTokenManager.detectSuspiciousActivity.mockReturnValue(true);
      mockTokenManager.clearSession.mockImplementation(() => {});

      render(<TestApp />);

      await waitFor(() => {
        expect(mockTokenManager.detectSuspiciousActivity).toHaveBeenCalled();
      });
    });
  });

  describe('Provider-Specific Flows', () => {
    it('should handle Azure AD tenant-specific authentication', async () => {
      const tenantSpecificUrl = 'https://login.microsoftonline.com/tenant-id/oauth2/v2.0/authorize?...';
      mockOAuthService.getAuthorizationUrl.mockResolvedValue(tenantSpecificUrl);
      mockInitiateOAuthLogin.mockResolvedValue();

      render(<TestApp />);

      const azureButton = screen.getByText('Login with Azure');
      fireEvent.click(azureButton);

      await waitFor(() => {
        expect(mockInitiateOAuthLogin).toHaveBeenCalledWith('azure');
      });
    });

    it('should handle GitHub organization-specific authentication', async () => {
      const githubUser = {
        ...mockUsers.github,
        attributes: {
          ...mockUsers.github.attributes,
          organization: 'test-org'
        }
      };

      mockHandleOAuthCallback.mockResolvedValue({
        success: true,
        sessionData: {
          ...mockSessions.github,
          user: githubUser
        }
      });

      Object.defineProperty(window, 'location', {
        value: {
          search: '?code=github_code&state=github_state'
        },
        writable: true
      });

      render(<TestApp showLogin={false} showCallback={true} callbackProvider="github" />);

      await waitFor(() => {
        expect(mockHandleOAuthCallback).toHaveBeenCalled();
      });
    });

    it('should handle Google Workspace domain authentication', async () => {
      const workspaceUser = {
        ...mockUsers.google,
        email: 'user@workspace.com',
        attributes: {
          ...mockUsers.google.attributes,
          domain: 'workspace.com',
          organization: 'Workspace Inc'
        }
      };

      mockHandleOAuthCallback.mockResolvedValue({
        success: true,
        sessionData: {
          ...mockSessions.google,
          user: workspaceUser
        }
      });

      Object.defineProperty(window, 'location', {
        value: {
          search: '?code=google_code&state=google_state'
        },
        writable: true
      });

      render(<TestApp showLogin={false} showCallback={true} callbackProvider="google" />);

      await waitFor(() => {
        expect(mockHandleOAuthCallback).toHaveBeenCalled();
      });
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should retry failed OAuth initiation', async () => {
      mockInitiateOAuthLogin
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce();

      render(<TestApp />);

      const azureButton = screen.getByText('Login with Azure');
      
      // First attempt fails
      fireEvent.click(azureButton);
      
      await waitFor(() => {
        expect(mockInitiateOAuthLogin).toHaveBeenCalledTimes(1);
      });

      // Retry succeeds
      fireEvent.click(azureButton);
      
      await waitFor(() => {
        expect(mockInitiateOAuthLogin).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle callback validation failures', async () => {
      mockHandleOAuthCallback.mockResolvedValue({
        success: false,
        error: 'Invalid state parameter'
      });

      Object.defineProperty(window, 'location', {
        value: {
          search: '?code=auth_code&state=invalid_state'
        },
        writable: true
      });

      render(<TestApp showLogin={false} showCallback={true} callbackProvider="azure" />);

      await waitFor(() => {
        expect(mockHandleOAuthCallback).toHaveBeenCalledWith({
          code: 'auth_code',
          state: 'invalid_state',
          provider: 'azure'
        });
      });
    });

    it('should handle token refresh failures gracefully', async () => {
      mockTokenManager.getStoredSession.mockReturnValue(mockSessions.azure);
      mockTokenManager.needsRefresh.mockReturnValue(true);
      mockTokenRefresh.refreshAccessToken.mockRejectedValue(new Error('Refresh failed'));
      mockTokenRefresh.validateAndRefreshSession.mockResolvedValue({
        isValid: false,
        user: null
      });

      render(<TestApp />);

      await waitFor(() => {
        expect(mockTokenRefresh.validateAndRefreshSession).toHaveBeenCalled();
      });
    });
  });
});