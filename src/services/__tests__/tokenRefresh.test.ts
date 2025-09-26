import { TokenRefreshService } from '../tokenRefresh';
import { TokenManager } from '../tokenManager';
import { SessionData, User } from '../../types/auth';

// Mock TokenManager
jest.mock('../tokenManager');
const mockTokenManager = TokenManager as jest.Mocked<typeof TokenManager>;

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock timers
jest.useFakeTimers();

// Mock console methods
const consoleSpy = {
  error: jest.spyOn(console, 'error').mockImplementation(() => {}),
  warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
};

describe('TokenRefreshService', () => {
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
    accessToken: 'new-access-token',
    refreshToken: 'new-refresh-token',
    expiresAt: Date.now() + 3600000, // 1 hour from now
    user: mockUser,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
    
    // Reset TokenManager mocks
    mockTokenManager.getRefreshToken.mockReturnValue('mock-refresh-token');
    mockTokenManager.storeSession.mockImplementation(() => {});
    mockTokenManager.clearSession.mockImplementation(() => {});
    mockTokenManager.incrementRefreshAttempts.mockImplementation(() => {});
    mockTokenManager.resetRefreshAttempts.mockImplementation(() => {});
  });

  afterEach(() => {
    // Clear any pending timers
    TokenRefreshService.clearAutoRefresh();
    jest.clearAllTimers();
  });

  afterAll(() => {
    // Restore console methods
    consoleSpy.error.mockRestore();
    consoleSpy.warn.mockRestore();
    jest.useRealTimers();
  });

  describe('refreshAccessToken', () => {
    it('should successfully refresh access token', async () => {
      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          expiresAt: Date.now() + 3600000,
          user: mockUser,
        }),
      } as Response);

      const result = await TokenRefreshService.refreshAccessToken();

      expect(result).toEqual(mockSessionData);
      expect(mockTokenManager.incrementRefreshAttempts).toHaveBeenCalled();
      expect(mockTokenManager.resetRefreshAttempts).toHaveBeenCalled();
      expect(mockTokenManager.storeSession).toHaveBeenCalledWith(mockSessionData);
    });

    it('should return null when no refresh token is available', async () => {
      mockTokenManager.getRefreshToken.mockReturnValue(null);

      const result = await TokenRefreshService.refreshAccessToken();

      expect(result).toBeNull();
      expect(consoleSpy.warn).toHaveBeenCalledWith('No refresh token available');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await TokenRefreshService.refreshAccessToken();

      expect(result).toBeNull();
      expect(mockTokenManager.clearSession).toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await TokenRefreshService.refreshAccessToken();

      expect(result).toBeNull();
      expect(mockTokenManager.clearSession).toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should prevent multiple simultaneous refresh attempts', async () => {
      // Mock a slow API response
      let resolvePromise: (value: any) => void;
      const slowPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(slowPromise as Promise<Response>);

      // Start two refresh attempts simultaneously
      const promise1 = TokenRefreshService.refreshAccessToken();
      const promise2 = TokenRefreshService.refreshAccessToken();

      // Resolve the API call
      resolvePromise!({
        ok: true,
        json: async () => mockSessionData,
      });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both should return the same result
      expect(result1).toEqual(result2);
      // But fetch should only be called once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('setupAutoRefresh', () => {
    it('should set up auto refresh timer for valid session', () => {
      const futureExpiration = Date.now() + (10 * 60 * 1000); // 10 minutes from now
      const validSession: SessionData = {
        ...mockSessionData,
        expiresAt: futureExpiration,
      };

      mockTokenManager.getStoredSession.mockReturnValue(validSession);
      mockTokenManager.isTokenValid.mockReturnValue(true);

      TokenRefreshService.setupAutoRefresh();

      // Should have set a timer
      expect(jest.getTimerCount()).toBe(1);
    });

    it('should not set up timer for invalid session', () => {
      mockTokenManager.getStoredSession.mockReturnValue(null);

      TokenRefreshService.setupAutoRefresh();

      expect(jest.getTimerCount()).toBe(0);
    });

    it('should clear existing timer before setting new one', () => {
      const validSession: SessionData = {
        ...mockSessionData,
        expiresAt: Date.now() + (10 * 60 * 1000),
      };

      mockTokenManager.getStoredSession.mockReturnValue(validSession);
      mockTokenManager.isTokenValid.mockReturnValue(true);

      // Set up first timer
      TokenRefreshService.setupAutoRefresh();
      expect(jest.getTimerCount()).toBe(1);

      // Set up second timer (should clear first)
      TokenRefreshService.setupAutoRefresh();
      expect(jest.getTimerCount()).toBe(1);
    });

    it('should trigger refresh when timer expires', async () => {
      const validSession: SessionData = {
        ...mockSessionData,
        expiresAt: Date.now() + (6 * 60 * 1000), // 6 minutes from now
      };

      mockTokenManager.getStoredSession.mockReturnValue(validSession);
      mockTokenManager.isTokenValid.mockReturnValue(true);

      // Mock successful refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      } as Response);

      TokenRefreshService.setupAutoRefresh();

      // Fast-forward time to trigger the timer
      jest.advanceTimersByTime(2 * 60 * 1000); // 2 minutes (should trigger refresh)

      // Wait for async operations
      await jest.runAllTimersAsync();

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('clearAutoRefresh', () => {
    it('should clear the auto refresh timer', () => {
      const validSession: SessionData = {
        ...mockSessionData,
        expiresAt: Date.now() + (10 * 60 * 1000),
      };

      mockTokenManager.getStoredSession.mockReturnValue(validSession);
      mockTokenManager.isTokenValid.mockReturnValue(true);

      TokenRefreshService.setupAutoRefresh();
      expect(jest.getTimerCount()).toBe(1);

      TokenRefreshService.clearAutoRefresh();
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe('checkAndRefreshToken', () => {
    it('should return true for valid token without refresh', async () => {
      const validSession: SessionData = {
        ...mockSessionData,
        expiresAt: Date.now() + (10 * 60 * 1000),
      };

      mockTokenManager.getStoredSession.mockReturnValue(validSession);
      mockTokenManager.isTokenValid.mockReturnValue(true);

      const result = await TokenRefreshService.checkAndRefreshToken();

      expect(result).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should refresh token when needed', async () => {
      const tokenNeedingRefresh: SessionData = {
        ...mockSessionData,
        expiresAt: Date.now() + (2 * 60 * 1000), // 2 minutes from now
      };

      mockTokenManager.getStoredSession.mockReturnValue(tokenNeedingRefresh);
      mockTokenManager.isTokenValid.mockReturnValue(false);
      mockTokenManager.needsRefresh.mockReturnValue(true);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      } as Response);

      const result = await TokenRefreshService.checkAndRefreshToken();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should return false for expired token that cannot be refreshed', async () => {
      const expiredSession: SessionData = {
        ...mockSessionData,
        expiresAt: Date.now() - 1000, // 1 second ago
      };

      mockTokenManager.getStoredSession.mockReturnValue(expiredSession);
      mockTokenManager.isTokenValid.mockReturnValue(false);
      mockTokenManager.needsRefresh.mockReturnValue(false);

      const result = await TokenRefreshService.checkAndRefreshToken();

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return false when no session exists', async () => {
      mockTokenManager.getStoredSession.mockReturnValue(null);

      const result = await TokenRefreshService.checkAndRefreshToken();

      expect(result).toBe(false);
    });
  });

  describe('validateAndRefreshSession', () => {
    it('should return valid session for good token', async () => {
      const validSession: SessionData = {
        ...mockSessionData,
        expiresAt: Date.now() + (10 * 60 * 1000),
      };

      mockTokenManager.detectSuspiciousActivity.mockReturnValue(false);
      mockTokenManager.getStoredSession.mockReturnValue(validSession);
      mockTokenManager.isTokenValid.mockReturnValue(true);

      const result = await TokenRefreshService.validateAndRefreshSession();

      expect(result).toEqual({
        isValid: true,
        user: mockUser,
      });
    });

    it('should clear session and return invalid for suspicious activity', async () => {
      mockTokenManager.detectSuspiciousActivity.mockReturnValue(true);

      const result = await TokenRefreshService.validateAndRefreshSession();

      expect(result).toEqual({
        isValid: false,
        user: null,
      });
      expect(mockTokenManager.clearSession).toHaveBeenCalled();
    });

    it('should attempt refresh for token needing refresh', async () => {
      const tokenNeedingRefresh: SessionData = {
        ...mockSessionData,
        expiresAt: Date.now() + (2 * 60 * 1000),
      };

      mockTokenManager.detectSuspiciousActivity.mockReturnValue(false);
      mockTokenManager.getStoredSession
        .mockReturnValueOnce(tokenNeedingRefresh)
        .mockReturnValueOnce(mockSessionData); // After refresh
      mockTokenManager.isTokenValid.mockReturnValue(false);
      mockTokenManager.needsRefresh.mockReturnValue(true);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessionData,
      } as Response);

      const result = await TokenRefreshService.validateAndRefreshSession();

      expect(result).toEqual({
        isValid: true,
        user: mockUser,
      });
    });

    it('should return invalid when session cannot be restored', async () => {
      mockTokenManager.detectSuspiciousActivity.mockReturnValue(false);
      mockTokenManager.getStoredSession.mockReturnValue(null);

      const result = await TokenRefreshService.validateAndRefreshSession();

      expect(result).toEqual({
        isValid: false,
        user: null,
      });
    });

    it('should clear session when refresh fails', async () => {
      const expiredSession: SessionData = {
        ...mockSessionData,
        expiresAt: Date.now() - 1000,
      };

      mockTokenManager.detectSuspiciousActivity.mockReturnValue(false);
      mockTokenManager.getStoredSession.mockReturnValue(expiredSession);
      mockTokenManager.isTokenValid.mockReturnValue(false);
      mockTokenManager.needsRefresh.mockReturnValue(false);

      const result = await TokenRefreshService.validateAndRefreshSession();

      expect(result).toEqual({
        isValid: false,
        user: null,
      });
      expect(mockTokenManager.clearSession).toHaveBeenCalled();
    });
  });
});