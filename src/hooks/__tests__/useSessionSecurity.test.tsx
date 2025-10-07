/**
 * Tests for useSessionSecurity hook
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useSessionSecurity, useSessionTimeoutWarning, useIdleTimeout } from '../useSessionSecurity';
import { SessionSecurityService, SessionSecurityEvent } from '../../services/sessionSecurityService';
import { useAuth } from '../../context/AuthContext';
import { User } from '../../types/auth';

// Mock dependencies
jest.mock('../../services/sessionSecurityService');
jest.mock('../../context/AuthContext');

const mockSessionSecurityService = SessionSecurityService as jest.Mocked<typeof SessionSecurityService>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

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

// Mock auth context
const mockAuthContext = {
  user: mockUser,
  isAuthenticated: true,
  isLoading: false,
  login: jest.fn(),
  logout: jest.fn(),
  refreshToken: jest.fn(),
  completeLogin: jest.fn(),
};

describe('useSessionSecurity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    mockUseAuth.mockReturnValue(mockAuthContext);
    
    // Mock SessionSecurityService methods
    mockSessionSecurityService.initialize.mockImplementation(() => {});
    mockSessionSecurityService.startSessionMonitoring.mockImplementation(() => {});
    mockSessionSecurityService.stopSessionMonitoring.mockImplementation(() => {});
    mockSessionSecurityService.getSessionInfo.mockReturnValue({
      isActive: true,
      sessionAge: 60000, // 1 minute
      idleTime: 30000, // 30 seconds
      timeUntilTimeout: 23 * 60 * 60 * 1000, // 23 hours
      timeUntilIdle: 29 * 60 * 1000, // 29 minutes
      activityCount: 10,
      refreshAttempts: 0,
      sessionStartTime: Date.now() - 60000,
    });
    mockSessionSecurityService.extendSession.mockImplementation(() => {});
    mockSessionSecurityService.validateSessionSecurity.mockResolvedValue({ isValid: true });
    mockSessionSecurityService.addEventListener.mockImplementation(() => {});
    mockSessionSecurityService.removeEventListener.mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('basic functionality', () => {
    it('should initialize session monitoring when user is authenticated', () => {
      const { result } = renderHook(() => useSessionSecurity());

      expect(mockSessionSecurityService.initialize).toHaveBeenCalled();
      expect(mockSessionSecurityService.startSessionMonitoring).toHaveBeenCalledWith(mockUser);
      expect(result.current.isMonitoring).toBe(true);
    });

    it('should not start monitoring when user is not authenticated', () => {
      mockUseAuth.mockReturnValue({
        ...mockAuthContext,
        isAuthenticated: false,
        user: null,
      });

      const { result } = renderHook(() => useSessionSecurity());

      expect(mockSessionSecurityService.startSessionMonitoring).not.toHaveBeenCalled();
      expect(result.current.isMonitoring).toBe(false);
    });

    it('should stop monitoring when component unmounts', () => {
      const { unmount } = renderHook(() => useSessionSecurity());

      unmount();

      expect(mockSessionSecurityService.stopSessionMonitoring).toHaveBeenCalled();
    });

    it('should provide session information', () => {
      const { result } = renderHook(() => useSessionSecurity());

      expect(result.current.sessionInfo).toBeDefined();
      expect(result.current.formattedSessionInfo).toBeDefined();
      expect(result.current.formattedSessionInfo?.sessionAgeFormatted).toBe('1m 0s');
    });
  });

  describe('session actions', () => {
    it('should extend session', () => {
      const { result } = renderHook(() => useSessionSecurity());

      act(() => {
        result.current.extendSession();
      });

      expect(mockSessionSecurityService.extendSession).toHaveBeenCalled();
    });

    it('should validate session', async () => {
      const { result } = renderHook(() => useSessionSecurity());

      await act(async () => {
        const isValid = await result.current.validateSession();
        expect(isValid).toBe(true);
      });

      expect(mockSessionSecurityService.validateSessionSecurity).toHaveBeenCalled();
    });

    it('should handle session validation failure', async () => {
      mockSessionSecurityService.validateSessionSecurity.mockResolvedValue({
        isValid: false,
        reason: 'Session expired',
      });

      const { result } = renderHook(() => useSessionSecurity());

      await act(async () => {
        const isValid = await result.current.validateSession();
        expect(isValid).toBe(false);
      });
    });
  });

  describe('warning management', () => {
    it('should show timeout warning when time is low', () => {
      // Mock session info with low timeout
      mockSessionSecurityService.getSessionInfo.mockReturnValue({
        isActive: true,
        sessionAge: 23.5 * 60 * 60 * 1000, // 23.5 hours
        idleTime: 30000,
        timeUntilTimeout: 4 * 60 * 1000, // 4 minutes (less than 5 minute threshold)
        timeUntilIdle: 29 * 60 * 1000,
        activityCount: 10,
        refreshAttempts: 0,
        sessionStartTime: Date.now() - 23.5 * 60 * 60 * 1000,
      });

      const { result } = renderHook(() => useSessionSecurity());

      // Advance timers to trigger update
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(result.current.showTimeoutWarning).toBe(true);
    });

    it('should show idle warning when idle time is low', () => {
      // Mock session info with low idle time
      mockSessionSecurityService.getSessionInfo.mockReturnValue({
        isActive: true,
        sessionAge: 60000,
        idleTime: 28 * 60 * 1000, // 28 minutes
        timeUntilTimeout: 23 * 60 * 60 * 1000,
        timeUntilIdle: 1.5 * 60 * 1000, // 1.5 minutes (less than 2 minute threshold)
        activityCount: 10,
        refreshAttempts: 0,
        sessionStartTime: Date.now() - 60000,
      });

      const { result } = renderHook(() => useSessionSecurity());

      // Advance timers to trigger update
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(result.current.showIdleWarning).toBe(true);
    });

    it('should dismiss timeout warning', () => {
      const { result } = renderHook(() => useSessionSecurity());

      act(() => {
        result.current.dismissTimeoutWarning();
      });

      expect(result.current.showTimeoutWarning).toBe(false);
    });

    it('should dismiss idle warning', () => {
      const { result } = renderHook(() => useSessionSecurity());

      act(() => {
        result.current.dismissIdleWarning();
      });

      expect(result.current.showIdleWarning).toBe(false);
    });
  });

  describe('event handling', () => {
    it('should handle session timeout event', () => {
      const onSessionTimeout = jest.fn();
      
      renderHook(() => useSessionSecurity({ onSessionTimeout }));

      // Simulate event listener call
      const addEventListenerCalls = mockSessionSecurityService.addEventListener.mock.calls;
      const timeoutListener = addEventListenerCalls.find(
        call => call[0] === SessionSecurityEvent.SESSION_TIMEOUT
      )?.[1];

      if (timeoutListener) {
        act(() => {
          timeoutListener(SessionSecurityEvent.SESSION_TIMEOUT);
        });
      }

      expect(onSessionTimeout).toHaveBeenCalled();
    });

    it('should handle idle timeout event', () => {
      const onIdleTimeout = jest.fn();
      
      renderHook(() => useSessionSecurity({ onIdleTimeout }));

      // Simulate event listener call
      const addEventListenerCalls = mockSessionSecurityService.addEventListener.mock.calls;
      const idleListener = addEventListenerCalls.find(
        call => call[0] === SessionSecurityEvent.IDLE_TIMEOUT
      )?.[1];

      if (idleListener) {
        act(() => {
          idleListener(SessionSecurityEvent.IDLE_TIMEOUT);
        });
      }

      expect(onIdleTimeout).toHaveBeenCalled();
    });

    it('should handle suspicious activity event', () => {
      const onSuspiciousActivity = jest.fn();
      
      renderHook(() => useSessionSecurity({ onSuspiciousActivity }));

      // Simulate event listener call
      const addEventListenerCalls = mockSessionSecurityService.addEventListener.mock.calls;
      const suspiciousListener = addEventListenerCalls.find(
        call => call[0] === SessionSecurityEvent.SUSPICIOUS_ACTIVITY
      )?.[1];

      const suspiciousData = { indicators: ['Excessive refresh attempts'] };

      if (suspiciousListener) {
        act(() => {
          suspiciousListener(SessionSecurityEvent.SUSPICIOUS_ACTIVITY, suspiciousData);
        });
      }

      expect(onSuspiciousActivity).toHaveBeenCalledWith(suspiciousData);
    });

    it('should handle session invalidated event', () => {
      const onSessionInvalidated = jest.fn();
      
      renderHook(() => useSessionSecurity({ onSessionInvalidated }));

      // Simulate event listener call
      const addEventListenerCalls = mockSessionSecurityService.addEventListener.mock.calls;
      const invalidatedListener = addEventListenerCalls.find(
        call => call[0] === SessionSecurityEvent.SESSION_INVALIDATED
      )?.[1];

      const invalidatedData = { reason: 'Suspicious activity detected' };

      if (invalidatedListener) {
        act(() => {
          invalidatedListener(SessionSecurityEvent.SESSION_INVALIDATED, invalidatedData);
        });
      }

      expect(onSessionInvalidated).toHaveBeenCalledWith('Suspicious activity detected');
    });

    it('should default to logout when no custom handlers provided', () => {
      renderHook(() => useSessionSecurity());

      // Simulate timeout event without custom handler
      const addEventListenerCalls = mockSessionSecurityService.addEventListener.mock.calls;
      const timeoutListener = addEventListenerCalls.find(
        call => call[0] === SessionSecurityEvent.SESSION_TIMEOUT
      )?.[1];

      if (timeoutListener) {
        act(() => {
          timeoutListener(SessionSecurityEvent.SESSION_TIMEOUT);
        });
      }

      expect(mockAuthContext.logout).toHaveBeenCalled();
    });
  });

  describe('security events tracking', () => {
    it('should track security events', () => {
      const { result } = renderHook(() => useSessionSecurity());

      // Simulate adding a security event
      const addEventListenerCalls = mockSessionSecurityService.addEventListener.mock.calls;
      const warningListener = addEventListenerCalls.find(
        call => call[0] === SessionSecurityEvent.SESSION_WARNING
      )?.[1];

      if (warningListener) {
        act(() => {
          warningListener(SessionSecurityEvent.SESSION_WARNING, { timeRemaining: 300000 });
        });
      }

      expect(result.current.securityEvents).toHaveLength(1);
      expect(result.current.securityEvents[0].event).toBe(SessionSecurityEvent.SESSION_WARNING);
    });

    it('should limit security events history', () => {
      const { result } = renderHook(() => useSessionSecurity({ maxEvents: 2 }));

      // Simulate adding multiple security events
      const addEventListenerCalls = mockSessionSecurityService.addEventListener.mock.calls;
      const warningListener = addEventListenerCalls.find(
        call => call[0] === SessionSecurityEvent.SESSION_WARNING
      )?.[1];

      if (warningListener) {
        act(() => {
          warningListener(SessionSecurityEvent.SESSION_WARNING, { event: 1 });
          warningListener(SessionSecurityEvent.SESSION_WARNING, { event: 2 });
          warningListener(SessionSecurityEvent.SESSION_WARNING, { event: 3 });
        });
      }

      expect(result.current.securityEvents).toHaveLength(2);
      expect(result.current.securityEvents[0].data.event).toBe(3); // Most recent first
    });
  });

  describe('time formatting', () => {
    it('should format time correctly', () => {
      const { result } = renderHook(() => useSessionSecurity());

      expect(result.current.formatTime(1000)).toBe('1s');
      expect(result.current.formatTime(60000)).toBe('1m 0s');
      expect(result.current.formatTime(3661000)).toBe('1h 1m');
    });
  });
});

describe('useSessionTimeoutWarning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue(mockAuthContext);
    
    mockSessionSecurityService.getSessionInfo.mockReturnValue({
      isActive: true,
      sessionAge: 60000,
      idleTime: 30000,
      timeUntilTimeout: 4 * 60 * 1000, // 4 minutes
      timeUntilIdle: 29 * 60 * 1000,
      activityCount: 10,
      refreshAttempts: 0,
      sessionStartTime: Date.now() - 60000,
    });
  });

  it('should provide timeout warning functionality', () => {
    const { result } = renderHook(() => useSessionTimeoutWarning(5));

    expect(result.current.showWarning).toBe(true);
    expect(result.current.timeRemaining).toBe(4 * 60 * 1000);
    expect(typeof result.current.extendSession).toBe('function');
    expect(typeof result.current.dismissWarning).toBe('function');
  });
});

describe('useIdleTimeout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue(mockAuthContext);
    
    mockSessionSecurityService.getSessionInfo.mockReturnValue({
      isActive: true,
      sessionAge: 60000,
      idleTime: 28 * 60 * 1000, // 28 minutes
      timeUntilTimeout: 23 * 60 * 60 * 1000,
      timeUntilIdle: 1.5 * 60 * 1000, // 1.5 minutes
      activityCount: 10,
      refreshAttempts: 0,
      sessionStartTime: Date.now() - 60000,
    });
  });

  it('should provide idle timeout functionality', () => {
    const { result } = renderHook(() => useIdleTimeout(30, 2));

    expect(result.current.showWarning).toBe(true);
    expect(result.current.timeUntilIdle).toBe(1.5 * 60 * 1000);
    expect(typeof result.current.extendSession).toBe('function');
    expect(typeof result.current.dismissWarning).toBe('function');
  });
});