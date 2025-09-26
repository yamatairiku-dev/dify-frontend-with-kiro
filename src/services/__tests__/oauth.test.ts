import { OAuthService } from '../oauth';
import { config } from '../../config/environment';

// Mock the environment config
jest.mock('../../config/environment', () => ({
  config: {
    oauthConfig: {
      azure: {
        clientId: 'test-azure-client-id',
        tenantId: 'test-azure-tenant-id',
      },
      github: {
        clientId: 'test-github-client-id',
      },
      google: {
        clientId: 'test-google-client-id',
      },
      redirectUri: 'http://localhost:5173/callback',
    },
  },
}));

// Mock crypto.getRandomValues and crypto.subtle
const mockGetRandomValues = jest.fn();
const mockDigest = jest.fn();

Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: mockGetRandomValues,
    subtle: {
      digest: mockDigest,
    },
  },
});

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

Object.defineProperty(global, 'sessionStorage', {
  value: mockSessionStorage,
});

// Mock btoa
Object.defineProperty(global, 'btoa', {
  value: jest.fn((str: string) => Buffer.from(str, 'binary').toString('base64')),
});

describe('OAuthService', () => {
  let oauthService: OAuthService;

  beforeEach(() => {
    oauthService = new OAuthService();
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockGetRandomValues.mockImplementation((array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = i % 256;
      }
      return array;
    });

    mockDigest.mockResolvedValue(new ArrayBuffer(32));
  });

  describe('getAuthorizationUrl', () => {
    it('should generate Azure AD authorization URL', async () => {
      const url = await oauthService.getAuthorizationUrl('azure');
      
      expect(url).toContain('https://login.microsoftonline.com/test-azure-tenant-id/oauth2/v2.0/authorize');
      expect(url).toContain('client_id=test-azure-client-id');
      expect(url).toContain('response_type=code');
      expect(url).toContain('code_challenge_method=S256');
      expect(url).toContain('scope=openid+profile+email+User.Read');
      
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('oauth_state', expect.any(String));
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('oauth_code_verifier', expect.any(String));
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('oauth_provider', 'azure');
    });

    it('should generate GitHub authorization URL', async () => {
      const url = await oauthService.getAuthorizationUrl('github');
      
      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('client_id=test-github-client-id');
      expect(url).toContain('scope=user%3Aemail+read%3Auser');
      expect(url).toContain('allow_signup=false');
      
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('oauth_provider', 'github');
    });

    it('should generate Google authorization URL', async () => {
      const url = await oauthService.getAuthorizationUrl('google');
      
      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('client_id=test-google-client-id');
      expect(url).toContain('response_type=code');
      expect(url).toContain('code_challenge_method=S256');
      expect(url).toContain('scope=openid+profile+email');
      expect(url).toContain('access_type=offline');
      expect(url).toContain('prompt=consent');
      
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

    it('should validate successful callback', () => {
      const result = oauthService.validateCallback('test-code', 'test-state', 'azure');
      expect(result).toBe(true);
    });

    it('should throw error for missing session state', () => {
      mockSessionStorage.getItem.mockReturnValue(null);
      
      expect(() => oauthService.validateCallback('test-code', 'test-state', 'azure'))
        .toThrow('Missing OAuth state or provider in session');
    });

    it('should throw error for invalid state', () => {
      expect(() => oauthService.validateCallback('test-code', 'wrong-state', 'azure'))
        .toThrow('Invalid OAuth state parameter');
    });

    it('should throw error for provider mismatch', () => {
      expect(() => oauthService.validateCallback('test-code', 'test-state', 'github'))
        .toThrow('OAuth provider mismatch');
    });
  });

  describe('getCodeVerifier', () => {
    it('should return stored code verifier', () => {
      mockSessionStorage.getItem.mockReturnValue('test-verifier');
      
      const verifier = oauthService.getCodeVerifier();
      expect(verifier).toBe('test-verifier');
      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('oauth_code_verifier');
    });

    it('should throw error if verifier not found', () => {
      mockSessionStorage.getItem.mockReturnValue(null);
      
      expect(() => oauthService.getCodeVerifier())
        .toThrow('Missing OAuth code verifier in session');
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

  describe('getProviderConfig', () => {
    it('should return Azure configuration', () => {
      const config = oauthService.getProviderConfig('azure');
      
      expect(config).toEqual({
        clientId: 'test-azure-client-id',
        tenantId: 'test-azure-tenant-id',
        redirectUri: 'http://localhost:5173/callback',
        scopes: ['openid', 'profile', 'email', 'User.Read'],
      });
    });

    it('should return GitHub configuration', () => {
      const config = oauthService.getProviderConfig('github');
      
      expect(config).toEqual({
        clientId: 'test-github-client-id',
        redirectUri: 'http://localhost:5173/callback',
        scopes: ['user:email', 'read:user'],
      });
    });

    it('should return Google configuration', () => {
      const config = oauthService.getProviderConfig('google');
      
      expect(config).toEqual({
        clientId: 'test-google-client-id',
        redirectUri: 'http://localhost:5173/callback',
        scopes: ['openid', 'profile', 'email'],
      });
    });
  });

  describe('generateState', () => {
    it('should generate cryptographically secure state', async () => {
      // Access private method through any cast for testing
      const state = (oauthService as any).generateState();
      
      expect(typeof state).toBe('string');
      expect(state.length).toBe(64); // 32 bytes * 2 hex chars
      expect(mockGetRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
    });
  });

  describe('generateCodeVerifier', () => {
    it('should generate PKCE code verifier', () => {
      const verifier = (oauthService as any).generateCodeVerifier();
      
      expect(typeof verifier).toBe('string');
      expect(verifier).not.toContain('+');
      expect(verifier).not.toContain('/');
      expect(verifier).not.toContain('=');
      expect(mockGetRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
    });
  });

  describe('generateCodeChallenge', () => {
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