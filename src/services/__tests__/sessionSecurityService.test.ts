/**
 * Tests for SessionSecurityService
 */

import { SessionSecurityService, SessionSecurityEvent } from '../sessionSecurityService';
import { TokenManager } from '../tokenManager';
import { TokenRefreshService } from '../tokenRefresh';
import { User } from '../../types/auth';

// Mock dependencies
jest.mock('../tokenManager');
jest.mock('../tokenRefresh');

const mockTokenManager = TokenManager as jest.Mocked<typeof TokenManager>;
const mockTokenRefreshService = TokenRefreshService as jest.Mocked<typeof TokenRefreshService>;

// Mock user for testing
const mockUser: User = {
  id: 'test-user-id',
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
    },
  ],
};

// Mock DOM APIs
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
  writable: true,
});

Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
  writable: true,
});

// Mock document and navigator
Object.defineProperty(document, 'addEventListener', {
  value: jest.fn(),
  writable: true,
});

Object.defineProperty(document, 'createElement', {
  value: jest.fn(() => ({
    getContext: jest.fn(() => ({
      textBaseline: '',
      font: '',
      fillText: jest.fn(),
    })),
    toDataURL: jest.fn(() => 'mock-canvas-data'),
  })),
  writable: true,
});

Object.defineProperty(navigator, 'userAgent', {
  value: 'Mozilla/5.0 (Test Browser)',
  writable: true,
});

Object.defineProperty(navigator, 'language', {
  value: 'en-US',
  writable: true,
});

Object.defineProperty(screen, 'width', {
  value: 1920,
  writable: true,
});

Object.defineProperty(screen, 'height', {
  value: 1080,
  writable: true,
});

describe('SessionSecurityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
    
    // Reset service state
    SessionSecurityService.stopSessionMonitoring();
    
    // Mock storage methods
    (sessionStorage.getItem as jest.Mock).mockReturnValue(null);
    (sessionStorage.setItem as jest.Mock).mockImplementation(() => {});
    (localStorage.getItem as jest.Mock).mockReturnValue(null);
    (localStorage.setItem as jest.Mock).mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    SessionSecurityService.stopSessionMonitoring();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      SessionSecurityService.initialize();
      
      const config = SessionSecurityService.getConfig();
      expect(config.sessionTimeout).toBe(24 * 60 * 60 * 1000); // 24 hours
      expect(config.idleTimeout).toBe(30 * 60 * 1000); // 30 minutes
      expect(config.maxRefreshAttempts).toBe(5);
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        sessionTimeout: 12 * 60 * 60 * 1000, // 12 hours
        idleTimeout: 15 * 60 * 1000, // 15 minutes
        maxRefreshAttempts: 3,
      };

      SessionSecurityService.initialize(customConfig);
      
      const config = SessionSecurityService.getConfig();
      expect(config.sessionTimeout).toBe(customConfig.sessionTimeout);
      expect(config.idleTimeout).toBe(customConfig.idleTimeout);
      expect(config.maxRefreshAttempts).toBe(customConfig.maxRefreshAttempts);
    });

    it('should not reinitialize if already initialized', () => {
      SessionSecurityService.initialize();
      const config1 = SessionSecurityService.getConfig();
      
      SessionSecurityService.initialize({ sessionTimeout: 1000 });
      const config2 = SessionSecurityService.getConfig();
      
      expect(config1).toEqual(config2);
    });
  });

  describe('session monitoring', () => {
    beforeEach(() => {
      SessionSecurityService.initialize();
    });

    it('should start session monitoring for authenticated user', () => {
      SessionSecurityService.startSessionMonitoring(mockUser);
      
      const sessionInfo = SessionSecurityService.getSessionInfo();
      expect(sessionInfo).not.toBeNull();
      expect(sessionInfo?.isActive).toBe(true);
      expect(sessionInfo?.activityCount).toBe(0);
    });

    it('should stop session monitoring', () => {
      SessionSecurityService.startSessionMonitoring(mockUser);
      SessionSecurityService.stopSessionMonitoring();
      
      const sessionInfo = SessionSecurityService.getSessionInfo();
      expect(sessionInfo).toBeNull();
    });

    it('should update activity when user is active', () => {
      SessionSecurityService.startSessionMonitoring(mockUser);
      
      const initialInfo = SessionSecurityService.getSessionInfo();
      const initialActivity = initialInfo?.activityCount || 0;
      
      SessionSecurityService.updateActivity();
      
      const updatedInfo = SessionSecurityService.getSessionInfo();
      expect(updatedInfo?.activityCount).toBe(initialActivity + 1);
    });

    it('should store session metadata', () => {
      SessionSecurityService.startSessionMonitoring(mockUser);
      
      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        'session_metadata',
        expect.stringContaining(mockUser.id)
      );
    });
  });

  describe('suspicious activity detection', () => {
    beforeEach(() => {
      SessionSecurityService.initialize();
      SessionSecurityService.startSessionMonitoring(mockUser);
    });

    it('should detect excessive refresh attempts', () => {
      // Simulate excessive refresh attempts
      for (let i = 0; i < 6; i++) {
        SessionSecurityService.updateActivity();
      }
      
      // Mock refresh attempts in session info
      const sessionInfo = SessionSecurityService.getSessionInfo();
      if (sessionInfo) {
        // Manually set refresh attempts for testing
        (sessionInfo as any).refreshAttempts = 6;
      }
      
      const isSuspicious = SessionSecurityService.detectSuspiciousActivity();
      expect(isSuspicious).toBe(true);
    });

    it('should detect session age anomalies', () => {
      // Fast-forward time to exceed session timeout
      jest.advanceTimersByTime(25 * 60 * 60 * 1000); // 25 hours
      
      const isSuspicious = SessionSecurityService.detectSuspiciousActivity();
      expect(isSuspicious).toBe(true);
    });

    it('should not detect suspicious activity for normal usage', () => {
      SessionSecurityService.updateActivity();
      
      const isSuspicious = SessionSecurityService.detectSuspiciousActivity();
      expect(isSuspicious).toBe(false);
    });
  });

  describe('session validation', () => {
    beforeEach(() => {
      SessionSecurityService.initialize();
      SessionSecurityService.startSessionMonitoring(mockUser);
    });

    it('should validate healthy session', async () => {
      mockTokenManager.getStoredSession.mockReturnValue({
        accessToken: 'valid-token',
        refreshToken: 'valid-refresh',
        expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour from now
        user: mockUser,
      });
      mockTokenManager.isTokenValid.mockReturnValue(true);
      
      const result = await SessionSecurityService.validateSessionSecurity();
      expect(result.isValid).toBe(true);
    });

    it('should invalidate session on timeout', async () => {
      // Fast-forward time to exceed session timeout
      jest.advanceTimersByTime(25 * 60 * 60 * 1000); // 25 hours
      
      const result = await SessionSecurityService.validateSessionSecurity();
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Session timeout');
    });

    it('should invalidate session on idle timeout', async () => {
      // Fast-forward time to exceed idle timeout
      jest.advanceTimersByTime(31 * 60 * 1000); // 31 minutes
      
      const result = await SessionSecurityService.validateSessionSecurity();
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Idle timeout');
    });

    it('should attempt token refresh for expired tokens', async () => {
      mockTokenManager.getStoredSession.mockReturnValue({
        accessToken: 'expired-token',
        refreshToken: 'valid-refresh',
        expiresAt: Date.now() - 1000, // Expired
        user: mockUser,
      });
      mockTokenManager.isTokenValid.mockReturnValue(false);
      mockTokenRefreshService.refreshAccessToken.mockResolvedValue({
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
        expiresAt: Date.now() + 60 * 60 * 1000,
        user: mockUser,
      });
      
      const result = await SessionSecurityService.validateSessionSecurity();
      expect(mockTokenRefreshService.refreshAccessToken).toHaveBeenCalled();
      expect(result.isValid).toBe(true);
    });

    it('should invalidate session on token refresh failure', async () => {
      mockTokenManager.getStoredSession.mockReturnValue({
        accessToken: 'expired-token',
        refreshToken: 'invalid-refresh',
        expiresAt: Date.now() - 1000, // Expired
        user: mockUser,
      });
      mockTokenManager.isTokenValid.mockReturnValue(false);
      mockTokenRefreshService.refreshAccessToken.mockRejectedValue(new Error('Refresh failed'));
      
      const result = await SessionSecurityService.validateSessionSecurity();
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Token validation failed');
    });
  });

  describe('event handling', () => {
    let eventListener: jest.Mock;

    beforeEach(() => {
      SessionSecurityService.initialize();
      eventListener = jest.fn();
    });

    it('should register and call event listeners', () => {
      SessionSecurityService.addEventListener(SessionSecurityEvent.SESSION_TIMEOUT, eventListener);
      
      // Trigger session timeout
      SessionSecurityService.startSessionMonitoring(mockUser);
      jest.advanceTimersByTime(25 * 60 * 60 * 1000); // 25 hours
      
      // Validate session to trigger timeout event
      SessionSecurityService.validateSessionSecurity();
      
      expect(eventListener).toHaveBeenCalledWith(
        SessionSecurityEvent.SESSION_TIMEOUT,
        undefined
      );
    });

    it('should remove event listeners', () => {
      SessionSecurityService.addEventListener(SessionSecurityEvent.SESSION_TIMEOUT, eventListener);
      SessionSecurityService.removeEventListener(SessionSecurityEvent.SESSION_TIMEOUT, eventListener);
      
      // Trigger session timeout
      SessionSecurityService.startSessionMonitoring(mockUser);
      jest.advanceTimersByTime(25 * 60 * 60 * 1000); // 25 hours
      
      // Validate session to trigger timeout event
      SessionSecurityService.validateSessionSecurity();
      
      expect(eventListener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      
      SessionSecurityService.addEventListener(SessionSecurityEvent.SESSION_WARNING, errorListener);
      
      // Should not throw when listener errors
      expect(() => {
        SessionSecurityService.startSessionMonitoring(mockUser);
      }).not.toThrow();
    });
  });

  describe('session extension', () => {
    beforeEach(() => {
      SessionSecurityService.initialize();
      SessionSecurityService.startSessionMonitoring(mockUser);
    });

    it('should extend session and reset idle timer', () => {
      const initialInfo = SessionSecurityService.getSessionInfo();
      const initialIdleTime = initialInfo?.idleTime || 0;
      
      // Advance time slightly
      jest.advanceTimersByTime(5000); // 5 seconds
      
      SessionSecurityService.extendSession();
      
      const updatedInfo = SessionSecurityService.getSessionInfo();
      // After extending session, idle time should be reset (lower than before)
      expect(updatedInfo?.idleTime).toBeLessThan(initialIdleTime + 5000);
    });
  });

  describe('concurrent session detection', () => {
    beforeEach(() => {
      SessionSecurityService.initialize();
    });

    it('should detect concurrent sessions', () => {
      // Mock existing sessions in localStorage
      (localStorage.getItem as jest.Mock).mockReturnValue(
        JSON.stringify([
          { id: 'session1', timestamp: Date.now() },
          { id: 'session2', timestamp: Date.now() },
          { id: 'session3', timestamp: Date.now() },
          { id: 'session4', timestamp: Date.now() }, // Exceeds limit of 3
        ])
      );
      
      SessionSecurityService.startSessionMonitoring(mockUser);
      
      const isSuspicious = SessionSecurityService.detectSuspiciousActivity();
      expect(isSuspicious).toBe(true);
    });

    it('should clean up old sessions', () => {
      // Mock old sessions in localStorage
      const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      (localStorage.getItem as jest.Mock).mockReturnValue(
        JSON.stringify([
          { id: 'old-session', timestamp: oldTimestamp },
        ])
      );
      
      SessionSecurityService.startSessionMonitoring(mockUser);
      
      // Should not detect as suspicious since old sessions are cleaned up
      const isSuspicious = SessionSecurityService.detectSuspiciousActivity();
      expect(isSuspicious).toBe(false);
    });
  });

  describe('session restoration', () => {
    beforeEach(() => {
      mockTokenRefreshService.validateAndRefreshSession.mockResolvedValue({
        isValid: true,
        user: mockUser,
      });
    });

    it('should restore valid session', async () => {
      // Mock valid session metadata
      (sessionStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'session_metadata') {
          return JSON.stringify({
            userId: mockUser.id,
            userAgent: navigator.userAgent,
          });
        }
        return null;
      });
      
      SessionSecurityService.initialize();
      
      // Wait for async restoration
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockTokenRefreshService.validateAndRefreshSession).toHaveBeenCalled();
    });

    it('should invalidate session with mismatched metadata', async () => {
      // Mock mismatched session metadata
      (sessionStorage.getItem as jest.Mock).mockImplementation((key) => {
        if (key === 'session_metadata') {
          return JSON.stringify({
            userId: 'different-user-id',
            userAgent: navigator.userAgent,
          });
        }
        return null;
      });
      
      SessionSecurityService.initialize();
      
      // Wait for async restoration
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockTokenManager.clearSession).toHaveBeenCalled();
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      SessionSecurityService.initialize();
      
      const newConfig = {
        sessionTimeout: 12 * 60 * 60 * 1000, // 12 hours
        idleTimeout: 15 * 60 * 1000, // 15 minutes
      };
      
      SessionSecurityService.updateConfig(newConfig);
      
      const config = SessionSecurityService.getConfig();
      expect(config.sessionTimeout).toBe(newConfig.sessionTimeout);
      expect(config.idleTimeout).toBe(newConfig.idleTimeout);
    });

    it('should get current configuration', () => {
      SessionSecurityService.initialize();
      
      const config = SessionSecurityService.getConfig();
      expect(config).toHaveProperty('sessionTimeout');
      expect(config).toHaveProperty('idleTimeout');
      expect(config).toHaveProperty('maxRefreshAttempts');
    });
  });
});