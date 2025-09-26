import { TokenManager } from '../tokenManager';
import { TokenRefreshService } from '../tokenRefresh';
import { SessionData, User } from '../../types/auth';

// Mock fetch for token refresh API calls
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock storage
const mockStorage = {
  sessionStorage: new Map<string, string>(),
  localStorage: new Map<string, string>(),
};

// Mock global storage
Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: jest.fn((key: string) => mockStorage.sessionStorage.get(key) || null),
    setItem: jest.fn((key: string, value: string) => mockStorage.sessionStorage.set(key, value)),
    removeItem: jest.fn((key: string) => mockStorage.sessionStorage.delete(key)),
    clear: jest.fn(() => mockStorage.sessionStorage.clear()),
  },
});

Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn((key: string) => mockStorage.localStorage.get(key) || null),
    setItem: jest.fn((key: string, value: string) => mockStorage.localStorage.set(key, value)),
    removeItem: jest.fn((key: string) => mockStorage.localStorage.delete(key)),
    clear: jest.fn(() => mockStorage.localStorage.clear()),
  },
});

describe('Token Management Integration', () => {
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
    jest.clearAllMocks();
    mockStorage.sessionStorage.clear();
    mockStorage.localStorage.clear();
  });

  it('should complete full token lifecycle', async () => {
    // 1. Store session data
    TokenManager.storeSession(mockSessionData);
    
    // Verify session is stored
    const storedSession = TokenManager.getStoredSession();
    expect(storedSession).toEqual(mockSessionData);
    
    // 2. Verify token is valid
    expect(TokenManager.isTokenValid(storedSession)).toBe(true);
    
    // 3. Get valid access token
    const accessToken = TokenManager.getValidAccessToken();
    expect(accessToken).toBe('mock-access-token');
    
    // 4. Test session validation
    const { isValid, user } = await TokenRefreshService.validateAndRefreshSession();
    expect(isValid).toBe(true);
    expect(user).toEqual(mockUser);
    
    // 5. Clear session (logout)
    TokenManager.clearSession();
    
    // Verify session is cleared
    const clearedSession = TokenManager.getStoredSession();
    expect(clearedSession).toBeNull();
    
    // Verify no valid access token
    const noToken = TokenManager.getValidAccessToken();
    expect(noToken).toBeNull();
  });

  it('should handle token refresh workflow', async () => {
    // Store session with token that needs refresh (expires in 2 minutes)
    const tokenNeedingRefresh: SessionData = {
      ...mockSessionData,
      expiresAt: Date.now() + (2 * 60 * 1000), // 2 minutes from now
    };
    
    TokenManager.storeSession(tokenNeedingRefresh);
    
    // Verify token needs refresh
    expect(TokenManager.needsRefresh(tokenNeedingRefresh)).toBe(true);
    
    // Mock successful refresh API response
    const refreshedSessionData: SessionData = {
      ...mockSessionData,
      accessToken: 'new-access-token',
      expiresAt: Date.now() + 3600000, // 1 hour from now
    };
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => refreshedSessionData,
    } as Response);
    
    // Perform token refresh
    const refreshResult = await TokenRefreshService.refreshAccessToken();
    expect(refreshResult).toEqual(refreshedSessionData);
    
    // Verify new token is stored
    const newSession = TokenManager.getStoredSession();
    expect(newSession?.accessToken).toBe('new-access-token');
    expect(TokenManager.isTokenValid(newSession)).toBe(true);
  });

  it('should handle suspicious activity detection', () => {
    // Store normal session
    TokenManager.storeSession(mockSessionData);
    
    // Normal activity should not be suspicious
    expect(TokenManager.detectSuspiciousActivity()).toBe(false);
    
    // Simulate too many refresh attempts
    for (let i = 0; i < 6; i++) {
      TokenManager.incrementRefreshAttempts();
    }
    
    // Should detect suspicious activity
    expect(TokenManager.detectSuspiciousActivity()).toBe(true);
  });

  it('should handle session expiration', async () => {
    // Store expired session
    const expiredSession: SessionData = {
      ...mockSessionData,
      expiresAt: Date.now() - 1000, // 1 second ago
    };
    
    TokenManager.storeSession(expiredSession);
    
    // Verify token is not valid
    expect(TokenManager.isTokenValid(expiredSession)).toBe(false);
    
    // Verify no valid access token
    expect(TokenManager.getValidAccessToken()).toBeNull();
    
    // Session validation should fail and clear session
    const { isValid, user } = await TokenRefreshService.validateAndRefreshSession();
    expect(isValid).toBe(false);
    expect(user).toBeNull();
    
    // Session should be cleared
    expect(TokenManager.getStoredSession()).toBeNull();
  });
});