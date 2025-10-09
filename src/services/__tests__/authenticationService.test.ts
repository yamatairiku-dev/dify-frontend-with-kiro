/**
 * Unit tests for authentication service
 * Task 9.1: Create unit tests for authentication service
 */

import { OAuthService } from '../oauth';
import { TokenManager } from '../tokenManager';
import { TokenRefreshService } from '../tokenRefresh';
import { config } from '../../config/environment';

// Mock dependencies
jest.mock('../../config/environment');
jest.mock('../tokenManager');
jest.mock('../tokenRefresh');

// Mock crypto and sessionStorage
const mockGetRandomValues = jest.fn();
const mockDigest = jest.fn();
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: mockGetRandomValues,
    subtle: { digest: mockDigest },
  },
});

Object.defineProperty(global, 'sessionStorage', {
  value: mockSessionStorage,
});

Object.defineProperty(global, 'btoa', {
  value: jest.fn((str: string) => Buffer.from(str, 'binary').toString('base64')),
});

describe('Authentication Service', () => {
  let oauthService: OAuthService;
  const mockTokenManager = TokenManager as jest.Mocked<typeof TokenManager>;
  const mockTokenRefreshService = TokenRefreshService as jest.Mocked<typeof TokenRefreshService>;

  beforeEach(() => {
    jest.clearAllMocks();
    oauthService = new OAuthService();
    
    // Setup default mocks
    mockGetRandomValues.mockImplementation((array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = i % 256;
      }
      return array;
    });
    
    mockDigest.mockResolvedValue(new ArrayBuffer(32));
    
    (config as any).oauthConfig = {
      azure: {
        clientId: 'test-azure-client',
        tenantId: 'test-tenant',
      },
      github: {
        clientId: 'test-github-client',
      },
      google: {
        clientId: 'test-google-client',
      },
      redirectUri: 'http://localhost:5173/callback',
    };
  });

  describe('OAuth Service', () => {
    describe('getAuthorizationUrl', () => {
      it('should generate valid Azure AD authorization URL', async () => {
        const url = await oauthService.getAuthorizationUrl('azure');
        
        expect(url).toContain('https://login.microsoftonline.com/test-tenant/oauth2/v2.0/authorize');
        expect(url).toContain('client_id=test-azure-client');
        expect(url).toContain('response_type=code');
        expect(url).toContain('code_challenge_method=S256');
        expect(mockSessionStorage.setItem).toHaveBeenCalledWith('oauth_provider', 'azure');
      });

      it('should generate valid GitHub authorization URL', async () => {
        const url = await oauthService.getAuthorizationUrl('github');
        
        expect(url).toContain('https://github.com/login/oauth/authorize');
        expect(url).toContain('client_id=test-github-client');
        expect(url).toContain('scope=user%3Aemail+read%3Auser');
        expect(mockSessionStorage.setItem).toHaveBeenCalledWith('oauth_provider', 'github');
      });

      it('should generate valid Google authorization URL', async () => {
        const url = await oauthService.getAuthorizationUrl('google');
        
        expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
        expect(url).toContain('client_id=test-google-client');
        expect(url).toContain('response_type=code');
        expect(url).toContain('access_type=offline');
        expect(mockSessionStorage.setItem).toHaveBeenCalledWith('oauth_provider', 'google');
      });

      it('should throw error for unsupported provider', async () => {
        await expect(oauthService.getAuthorizationUrl('invalid' as any))
          .rejects.toThrow('Unsupported OAuth provider: invalid');
      });
    });

    describe('validateCallback', () => {
      beforeEach(() => {
        mockSessionStorage.getItem.mockImplementation((key: string) => {
          if (key === 'oauth_state') return 'test-state';
          if (key === 'oauth_provider') return 'azure';
          return null;
        });
      });

      it('should validate successful callback with correct state', () => {
        const result = oauthService.validateCallback('test-code', 'test-state', 'azure');
        expect(result).toBe(true);
      });

      it('should throw error for invalid state', () => {
        expect(() => oauthService.validateCallback('test-code', 'wrong-state', 'azure'))
          .toThrow('Invalid OAuth state parameter');
      });

      it('should throw error for provider mismatch', () => {
        expect(() => oauthService.validateCallback('test-code', 'test-state', 'github'))
          .toThrow('OAuth provider mismatch');
      });

      it('should throw error for missing session state', () => {
        mockSessionStorage.getItem.mockReturnValue(null);
        
        expect(() => oauthService.validateCallback('test-code', 'test-state', 'azure'))
          .toThrow('Missing OAuth state or provider in session');
      });
    });

    describe('clearOAuthSession', () => {
      it('should clear all OAuth session data', () => {
        oauthService.clearOAuthSession();
        
        expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('oauth_state');
        expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('oauth_code_verifier');
        expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('oauth_provider');
      });
    });
  });

  describe('Token Management', () => {
    describe('TokenManager', () => {
      it('should store session data securely', () => {
        const sessionData = {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresAt: Date.now() + 3600000,
          user: {
            id: 'user-1',
            email: 'test@example.com',
            name: 'Test User',
            provider: 'azure' as const,
            attributes: { domain: 'example.com', roles: ['user'] },
            permissions: [],
          },
        };

        mockTokenManager.storeSession.mockImplementation(() => {});
        mockTokenManager.storeSession(sessionData);
        
        expect(mockTokenManager.storeSession).toHaveBeenCalledWith(sessionData);
      });

      it('should validate token expiration', () => {
        const expiredSession = {
          accessToken: 'expired-token',
          refreshToken: 'refresh-token',
          expiresAt: Date.now() - 1000, // Expired
          user: {} as any,
        };

        mockTokenManager.isTokenValid.mockReturnValue(false);
        const isValid = mockTokenManager.isTokenValid(expiredSession);
        
        expect(isValid).toBe(false);
        expect(mockTokenManager.isTokenValid).toHaveBeenCalledWith(expiredSession);
      });

      it('should detect when token needs refresh', () => {
        const soonToExpireSession = {
          accessToken: 'token',
          refreshToken: 'refresh-token',
          expiresAt: Date.now() + 60000, // Expires in 1 minute
          user: {} as any,
        };

        mockTokenManager.needsRefresh.mockReturnValue(true);
        const needsRefresh = mockTokenManager.needsRefresh(soonToExpireSession);
        
        expect(needsRefresh).toBe(true);
        expect(mockTokenManager.needsRefresh).toHaveBeenCalledWith(soonToExpireSession);
      });

      it('should clear session on logout', () => {
        mockTokenManager.clearSession.mockImplementation(() => {});
        mockTokenManager.clearSession();
        
        expect(mockTokenManager.clearSession).toHaveBeenCalled();
      });
    });

    describe('TokenRefreshService', () => {
      it('should refresh access token successfully', async () => {
        const newSessionData = {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          expiresAt: Date.now() + 3600000,
          user: {} as any,
        };

        mockTokenRefreshService.refreshAccessToken.mockResolvedValue(newSessionData);
        const result = await mockTokenRefreshService.refreshAccessToken();
        
        expect(result).toEqual(newSessionData);
        expect(mockTokenRefreshService.refreshAccessToken).toHaveBeenCalled();
      });

      it('should handle refresh failure', async () => {
        mockTokenRefreshService.refreshAccessToken.mockResolvedValue(null);
        const result = await mockTokenRefreshService.refreshAccessToken();
        
        expect(result).toBeNull();
      });

      it('should validate and refresh session', async () => {
        const validationResult = {
          isValid: true,
          user: {
            id: 'user-1',
            email: 'test@example.com',
            name: 'Test User',
            provider: 'azure' as const,
            attributes: { domain: 'example.com', roles: ['user'] },
            permissions: [],
          },
        };

        mockTokenRefreshService.validateAndRefreshSession.mockResolvedValue(validationResult);
        const result = await mockTokenRefreshService.validateAndRefreshSession();
        
        expect(result.isValid).toBe(true);
        expect(result.user).toBeDefined();
      });
    });
  });

  describe('Security Features', () => {
    it('should generate cryptographically secure state', () => {
      const state = (oauthService as any).generateState();
      
      expect(typeof state).toBe('string');
      expect(state.length).toBe(64); // 32 bytes * 2 hex chars
      expect(mockGetRandomValues).toHaveBeenCalled();
    });

    it('should generate PKCE code verifier', () => {
      const verifier = (oauthService as any).generateCodeVerifier();
      
      expect(typeof verifier).toBe('string');
      expect(verifier).not.toContain('+');
      expect(verifier).not.toContain('/');
      expect(verifier).not.toContain('=');
    });

    it('should generate PKCE code challenge', async () => {
      const challenge = await (oauthService as any).generateCodeChallenge('test-verifier');
      
      expect(typeof challenge).toBe('string');
      expect(challenge).not.toContain('+');
      expect(challenge).not.toContain('/');
      expect(challenge).not.toContain('=');
      expect(mockDigest).toHaveBeenCalledWith('SHA-256', expect.any(Object));
    });
  });
});