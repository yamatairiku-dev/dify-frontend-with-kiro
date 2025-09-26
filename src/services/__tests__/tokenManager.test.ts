import { TokenManager } from '../tokenManager';
import { SessionData, User } from '../../types/auth';

// Create a more robust storage mock
class StorageMock {
  private store: Record<string, string> = {};
  
  getItem = jest.fn((key: string) => this.store[key] || null);
  setItem = jest.fn((key: string, value: string) => {
    this.store[key] = value;
  });
  removeItem = jest.fn((key: string) => {
    delete this.store[key];
  });
  clear = jest.fn(() => {
    this.store = {};
  });
  
  // Helper methods for testing
  _getStore() {
    return { ...this.store };
  }
  
  _setStore(newStore: Record<string, string>) {
    this.store = { ...newStore };
  }
}

const localStorageMock = new StorageMock();
const sessionStorageMock = new StorageMock();

// Mock global storage objects
Object.defineProperty(window, 'localStorage', { 
  value: localStorageMock,
  writable: true
});
Object.defineProperty(window, 'sessionStorage', { 
  value: sessionStorageMock,
  writable: true
});

// Mock console methods
const consoleSpy = {
  error: jest.spyOn(console, 'error').mockImplementation(() => {}),
  warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
};

describe('TokenManager', () => {
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
    expiresAt: Date.now() + 3600000, // 1 hour from now
    user: mockUser,
  };

  beforeEach(() => {
    // Clear all mocks and storage
    jest.clearAllMocks();
    localStorageMock.clear();
    sessionStorageMock.clear();
    
    // Reset mock implementations to default behavior
    localStorageMock.getItem.mockImplementation((key: string) => localStorageMock._getStore()[key] || null);
    localStorageMock.setItem.mockImplementation((key: string, value: string) => {
      (localStorageMock as any).store[key] = value;
    });
    localStorageMock.removeItem.mockImplementation((key: string) => {
      delete (localStorageMock as any).store[key];
    });
    
    sessionStorageMock.getItem.mockImplementation((key: string) => sessionStorageMock._getStore()[key] || null);
    sessionStorageMock.setItem.mockImplementation((key: string, value: string) => {
      (sessionStorageMock as any).store[key] = value;
    });
    sessionStorageMock.removeItem.mockImplementation((key: string) => {
      delete (sessionStorageMock as any).store[key];
    });
  });

  afterAll(() => {
    // Restore console methods
    consoleSpy.error.mockRestore();
    consoleSpy.warn.mockRestore();
  });

  describe('storeSession', () => {
    it('should store session data in sessionStorage and refresh token in localStorage', () => {
      TokenManager.storeSession(mockSessionData);

      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        'dify_auth_session',
        expect.stringContaining('mock-access-token')
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'dify_refresh_token',
        expect.stringContaining('mock-refresh-token')
      );
    });

    it('should handle missing refresh token gracefully', () => {
      const sessionWithoutRefresh = { ...mockSessionData, refreshToken: '' };
      
      expect(() => {
        TokenManager.storeSession(sessionWithoutRefresh);
      }).not.toThrow();

      expect(sessionStorageMock.setItem).toHaveBeenCalled();
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('should throw error if storage fails', () => {
      sessionStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      expect(() => {
        TokenManager.storeSession(mockSessionData);
      }).toThrow('Failed to store authentication session');
    });
  });

  describe('getStoredSession', () => {
    it('should retrieve stored session data', () => {
      // Store session first
      TokenManager.storeSession(mockSessionData);

      const retrieved = TokenManager.getStoredSession();

      expect(retrieved).toEqual(expect.objectContaining({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: mockUser,
      }));
    });

    it('should return null if no session is stored', () => {
      const retrieved = TokenManager.getStoredSession();
      expect(retrieved).toBeNull();
    });

    it('should clear session if it is too old', () => {
      // Mock old session (25 hours ago)
      const oldSessionData = {
        ...mockSessionData,
        expiresAt: Date.now() + 3600000, // Still valid expiration
      };
      
      // Manually store old session
      const sessionInfo = {
        accessToken: oldSessionData.accessToken,
        user: oldSessionData.user,
        expiresAt: oldSessionData.expiresAt,
        storedAt: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
      };
      sessionStorageMock.setItem('dify_auth_session', JSON.stringify(sessionInfo));

      const retrieved = TokenManager.getStoredSession();

      expect(retrieved).toBeNull();
      expect(sessionStorageMock.removeItem).toHaveBeenCalled();
    });

    it('should handle corrupted session data', () => {
      sessionStorageMock.setItem('dify_auth_session', 'invalid-json');

      const retrieved = TokenManager.getStoredSession();

      expect(retrieved).toBeNull();
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('isTokenValid', () => {
    it('should return true for valid token', () => {
      const validSession = {
        ...mockSessionData,
        expiresAt: Date.now() + 3600000, // 1 hour from now
      };

      expect(TokenManager.isTokenValid(validSession)).toBe(true);
    });

    it('should return false for expired token', () => {
      const expiredSession = {
        ...mockSessionData,
        expiresAt: Date.now() - 1000, // 1 second ago
      };

      expect(TokenManager.isTokenValid(expiredSession)).toBe(false);
    });

    it('should return false for token expiring within buffer period', () => {
      const soonToExpireSession = {
        ...mockSessionData,
        expiresAt: Date.now() + (2 * 60 * 1000), // 2 minutes from now (within 5-minute buffer)
      };

      expect(TokenManager.isTokenValid(soonToExpireSession)).toBe(false);
    });

    it('should return false for null session', () => {
      expect(TokenManager.isTokenValid(null)).toBe(false);
    });

    it('should return false for session without access token', () => {
      const sessionWithoutToken = { ...mockSessionData, accessToken: '' };
      expect(TokenManager.isTokenValid(sessionWithoutToken)).toBe(false);
    });
  });

  describe('needsRefresh', () => {
    it('should return true for token within refresh buffer', () => {
      const tokenNeedingRefresh = {
        ...mockSessionData,
        expiresAt: Date.now() + (2 * 60 * 1000), // 2 minutes from now
      };

      expect(TokenManager.needsRefresh(tokenNeedingRefresh)).toBe(true);
    });

    it('should return false for token not needing refresh', () => {
      const validToken = {
        ...mockSessionData,
        expiresAt: Date.now() + (10 * 60 * 1000), // 10 minutes from now
      };

      expect(TokenManager.needsRefresh(validToken)).toBe(false);
    });

    it('should return false for expired token', () => {
      const expiredToken = {
        ...mockSessionData,
        expiresAt: Date.now() - 1000, // 1 second ago
      };

      expect(TokenManager.needsRefresh(expiredToken)).toBe(false);
    });
  });

  describe('decodeJWT', () => {
    it('should decode valid JWT token', () => {
      // Create a mock JWT token (header.payload.signature)
      const payload = {
        sub: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        provider: 'github',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        permissions: ['read:workflows'],
      };
      
      const encodedPayload = btoa(JSON.stringify(payload));
      const mockJWT = `header.${encodedPayload}.signature`;

      const decoded = TokenManager.decodeJWT(mockJWT);

      expect(decoded).toEqual(payload);
    });

    it('should return null for invalid JWT format', () => {
      const invalidJWT = 'invalid.jwt';
      const decoded = TokenManager.decodeJWT(invalidJWT);
      expect(decoded).toBeNull();
    });

    it('should handle decode errors gracefully', () => {
      const malformedJWT = 'header.invalid-base64.signature';
      const decoded = TokenManager.decodeJWT(malformedJWT);
      expect(decoded).toBeNull();
    });
  });

  describe('extractUserFromToken', () => {
    it('should extract user information from valid token', () => {
      const payload = {
        sub: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        provider: 'github',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        permissions: ['read:workflows'],
      };
      
      const encodedPayload = btoa(JSON.stringify(payload));
      const mockJWT = `header.${encodedPayload}.signature`;

      const user = TokenManager.extractUserFromToken(mockJWT);

      expect(user).toEqual({
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        provider: 'github',
        attributes: {
          domain: 'example.com',
          roles: [],
          department: undefined,
          organization: undefined,
        },
        permissions: [{
          resource: 'read:workflows',
          actions: ['read'],
        }],
      });
    });

    it('should return null for invalid token', () => {
      const user = TokenManager.extractUserFromToken('invalid-token');
      expect(user).toBeNull();
    });
  });

  describe('clearSession', () => {
    it('should clear all session data', () => {
      // Store some session data first
      TokenManager.storeSession(mockSessionData);
      sessionStorageMock.setItem('oauth_state', 'test-state');

      TokenManager.clearSession();

      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('dify_auth_session');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('dify_refresh_token');
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('oauth_state');
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('oauth_code_verifier');
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('oauth_provider');
    });

    it('should handle storage errors gracefully', () => {
      sessionStorageMock.removeItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      expect(() => {
        TokenManager.clearSession();
      }).not.toThrow();

      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('getValidAccessToken', () => {
    it('should return access token for valid session', () => {
      TokenManager.storeSession(mockSessionData);

      const token = TokenManager.getValidAccessToken();

      expect(token).toBe('mock-access-token');
    });

    it('should return null for invalid session', () => {
      const expiredSession = {
        ...mockSessionData,
        expiresAt: Date.now() - 1000,
      };
      TokenManager.storeSession(expiredSession);

      const token = TokenManager.getValidAccessToken();

      expect(token).toBeNull();
    });

    it('should return null when no session exists', () => {
      const token = TokenManager.getValidAccessToken();
      expect(token).toBeNull();
    });
  });

  describe('detectSuspiciousActivity', () => {
    it('should detect too many refresh attempts', () => {
      // Simulate multiple refresh attempts
      sessionStorageMock.setItem('refresh_attempts', '6');

      const isSuspicious = TokenManager.detectSuspiciousActivity();

      expect(isSuspicious).toBe(true);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Too many refresh attempts')
      );
    });

    it('should detect session too old', () => {
      // Create session that's too old
      const oldSessionInfo = {
        accessToken: 'token',
        user: mockUser,
        expiresAt: Date.now() + 3600000,
        storedAt: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
      };
      sessionStorageMock.setItem('dify_auth_session', JSON.stringify(oldSessionInfo));

      const isSuspicious = TokenManager.detectSuspiciousActivity();

      expect(isSuspicious).toBe(true);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Session too old')
      );
    });

    it('should return false for normal activity', () => {
      TokenManager.storeSession(mockSessionData);

      const isSuspicious = TokenManager.detectSuspiciousActivity();

      expect(isSuspicious).toBe(false);
    });

    it('should return true on error (err on side of caution)', () => {
      // Mock getStoredSession to throw an error
      const originalGetStoredSession = TokenManager.getStoredSession;
      jest.spyOn(TokenManager, 'getStoredSession').mockImplementation(() => {
        throw new Error('Storage error');
      });

      const isSuspicious = TokenManager.detectSuspiciousActivity();

      expect(isSuspicious).toBe(true);
      
      // Restore original method
      (TokenManager.getStoredSession as jest.Mock).mockRestore();
    });
  });

  describe('refresh attempt tracking', () => {
    it('should increment refresh attempts', () => {
      // First increment (from 0 to 1)
      TokenManager.incrementRefreshAttempts();
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('refresh_attempts', '1');
      
      // Second increment (from 1 to 2) - the storage mock should automatically handle this
      TokenManager.incrementRefreshAttempts();
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith('refresh_attempts', '2');
    });

    it('should reset refresh attempts', () => {
      TokenManager.resetRefreshAttempts();

      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('refresh_attempts');
    });
  });
});