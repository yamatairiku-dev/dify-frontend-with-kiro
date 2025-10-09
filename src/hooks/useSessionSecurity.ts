/**
 * React hook for session security management
 * Provides session monitoring, timeout warnings, and security event handling
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { SessionSecurityService, SessionSecurityEvent } from '../services/sessionSecurityService';
import { useAuth } from '../context/AuthContext';

// Session security state interface
interface SessionSecurityState {
  isMonitoring: boolean;
  sessionInfo: {
    isActive: boolean;
    sessionAge: number;
    idleTime: number;
    timeUntilTimeout: number;
    timeUntilIdle: number;
    activityCount: number;
    refreshAttempts: number;
    sessionStartTime: number;
  } | null;
  showTimeoutWarning: boolean;
  showIdleWarning: boolean;
  securityEvents: Array<{
    event: SessionSecurityEvent;
    timestamp: number;
    data?: any;
  }>;
}

// Hook options
interface UseSessionSecurityOptions {
  enableWarnings?: boolean;
  warningThreshold?: number; // Minutes before timeout to show warning
  idleWarningThreshold?: number; // Minutes before idle timeout to show warning
  maxEvents?: number; // Maximum number of events to keep in history
  onSessionTimeout?: () => void;
  onIdleTimeout?: () => void;
  onSuspiciousActivity?: (data: any) => void;
  onSessionInvalidated?: (reason: string) => void;
}

// Default options
const DEFAULT_OPTIONS: UseSessionSecurityOptions = {
  enableWarnings: true,
  warningThreshold: 5, // 5 minutes
  idleWarningThreshold: 2, // 2 minutes
  maxEvents: 50,
};

/**
 * Session security management hook
 */
export const useSessionSecurity = (options: UseSessionSecurityOptions = {}) => {
  const { user, isAuthenticated, logout } = useAuth();
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // State management
  const [state, setState] = useState<SessionSecurityState>({
    isMonitoring: false,
    sessionInfo: null,
    showTimeoutWarning: false,
    showIdleWarning: false,
    securityEvents: [],
  });

  // Refs for cleanup
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventListenersRef = useRef<Map<SessionSecurityEvent, any>>(new Map());

  // Update session info periodically
  const updateSessionInfo = useCallback(() => {
    const sessionInfo = SessionSecurityService.getSessionInfo();
    
    setState(prevState => {
      const newState = { ...prevState, sessionInfo };
      
      if (sessionInfo && opts.enableWarnings) {
        // Check for timeout warning
        const timeoutWarningMs = (opts.warningThreshold || 5) * 60 * 1000;
        const showTimeoutWarning = sessionInfo.timeUntilTimeout <= timeoutWarningMs && sessionInfo.timeUntilTimeout > 0;
        
        // Check for idle warning
        const idleWarningMs = (opts.idleWarningThreshold || 2) * 60 * 1000;
        const showIdleWarning = sessionInfo.timeUntilIdle <= idleWarningMs && sessionInfo.timeUntilIdle > 0;
        
        newState.showTimeoutWarning = showTimeoutWarning;
        newState.showIdleWarning = showIdleWarning;
      }
      
      return newState;
    });
  }, [opts.enableWarnings, opts.warningThreshold, opts.idleWarningThreshold]);

  // Add security event to history
  const addSecurityEvent = useCallback((event: SessionSecurityEvent, data?: any) => {
    setState(prevState => {
      const newEvent = {
        event,
        timestamp: Date.now(),
        data,
      };
      
      const newEvents = [newEvent, ...prevState.securityEvents];
      
      // Limit event history
      if (newEvents.length > (opts.maxEvents || 50)) {
        newEvents.splice(opts.maxEvents || 50);
      }
      
      return {
        ...prevState,
        securityEvents: newEvents,
      };
    });
  }, [opts.maxEvents]);

  // Set up event listeners
  const setupEventListeners = useCallback(() => {
    // Clear existing listeners
    eventListenersRef.current.forEach((listener, event) => {
      SessionSecurityService.removeEventListener(event, listener);
    });
    eventListenersRef.current.clear();

    // Session timeout handler
    const timeoutListener = () => {
      addSecurityEvent(SessionSecurityEvent.SESSION_TIMEOUT);
      if (opts.onSessionTimeout) {
        opts.onSessionTimeout();
      } else {
        logout();
      }
    };

    // Idle timeout handler
    const idleListener = () => {
      addSecurityEvent(SessionSecurityEvent.IDLE_TIMEOUT);
      if (opts.onIdleTimeout) {
        opts.onIdleTimeout();
      } else {
        logout();
      }
    };

    // Suspicious activity handler
    const suspiciousActivityListener = (event: SessionSecurityEvent, data: any) => {
      addSecurityEvent(event, data);
      if (opts.onSuspiciousActivity) {
        opts.onSuspiciousActivity(data);
      }
    };

    // Session invalidated handler
    const invalidatedListener = (event: SessionSecurityEvent, data: any) => {
      addSecurityEvent(event, data);
      if (opts.onSessionInvalidated) {
        opts.onSessionInvalidated(data?.reason || 'Unknown reason');
      } else {
        logout();
      }
    };

    // Session warning handler
    const warningListener = (event: SessionSecurityEvent, data: any) => {
      addSecurityEvent(event, data);
    };

    // Session restored handler
    const restoredListener = (event: SessionSecurityEvent, data: any) => {
      addSecurityEvent(event, data);
    };

    // Register listeners
    SessionSecurityService.addEventListener(SessionSecurityEvent.SESSION_TIMEOUT, timeoutListener);
    SessionSecurityService.addEventListener(SessionSecurityEvent.IDLE_TIMEOUT, idleListener);
    SessionSecurityService.addEventListener(SessionSecurityEvent.SUSPICIOUS_ACTIVITY, suspiciousActivityListener);
    SessionSecurityService.addEventListener(SessionSecurityEvent.SESSION_INVALIDATED, invalidatedListener);
    SessionSecurityService.addEventListener(SessionSecurityEvent.SESSION_WARNING, warningListener);
    SessionSecurityService.addEventListener(SessionSecurityEvent.SESSION_RESTORED, restoredListener);

    // Store references for cleanup
    eventListenersRef.current.set(SessionSecurityEvent.SESSION_TIMEOUT, timeoutListener);
    eventListenersRef.current.set(SessionSecurityEvent.IDLE_TIMEOUT, idleListener);
    eventListenersRef.current.set(SessionSecurityEvent.SUSPICIOUS_ACTIVITY, suspiciousActivityListener);
    eventListenersRef.current.set(SessionSecurityEvent.SESSION_INVALIDATED, invalidatedListener);
    eventListenersRef.current.set(SessionSecurityEvent.SESSION_WARNING, warningListener);
    eventListenersRef.current.set(SessionSecurityEvent.SESSION_RESTORED, restoredListener);
  }, [addSecurityEvent, logout, opts]);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    if (!user || !isAuthenticated) {
      return;
    }

    // Initialize session security service
    SessionSecurityService.initialize();
    
    // Start session monitoring
    SessionSecurityService.startSessionMonitoring(user);
    
    // Set up event listeners
    setupEventListeners();
    
    // Start periodic updates
    intervalRef.current = setInterval(updateSessionInfo, 1000); // Update every second
    
    setState(prevState => ({
      ...prevState,
      isMonitoring: true,
    }));

    console.log('Session security monitoring started');
  }, [user, isAuthenticated, setupEventListeners, updateSessionInfo]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Remove event listeners
    eventListenersRef.current.forEach((listener, event) => {
      SessionSecurityService.removeEventListener(event, listener);
    });
    eventListenersRef.current.clear();

    // Stop session monitoring
    SessionSecurityService.stopSessionMonitoring();

    setState(prevState => ({
      ...prevState,
      isMonitoring: false,
      sessionInfo: null,
      showTimeoutWarning: false,
      showIdleWarning: false,
    }));

    console.log('Session security monitoring stopped');
  }, []);

  // Extend session (reset idle timer)
  const extendSession = useCallback(() => {
    SessionSecurityService.extendSession();
    setState(prevState => ({
      ...prevState,
      showIdleWarning: false,
      showTimeoutWarning: false,
    }));
  }, []);

  // Validate session security
  const validateSession = useCallback(async () => {
    try {
      const result = await SessionSecurityService.validateSessionSecurity();
      if (!result.isValid) {
        addSecurityEvent(SessionSecurityEvent.SESSION_INVALIDATED, { reason: result.reason });
        return false;
      }
      return true;
    } catch (error) {
      console.error('Session validation error:', error);
      addSecurityEvent(SessionSecurityEvent.SESSION_INVALIDATED, { reason: 'Validation error' });
      return false;
    }
  }, [addSecurityEvent]);

  // Dismiss warnings
  const dismissTimeoutWarning = useCallback(() => {
    setState(prevState => ({
      ...prevState,
      showTimeoutWarning: false,
    }));
  }, []);

  const dismissIdleWarning = useCallback(() => {
    setState(prevState => ({
      ...prevState,
      showIdleWarning: false,
    }));
  }, []);

  // Effect to start/stop monitoring based on authentication state
  useEffect(() => {
    if (isAuthenticated && user) {
      startMonitoring();
    } else {
      stopMonitoring();
    }

    // Cleanup on unmount
    return () => {
      stopMonitoring();
    };
  }, [isAuthenticated, user, startMonitoring, stopMonitoring]);

  // Format time for display
  const formatTime = useCallback((milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }, []);

  // Get formatted session info for display
  const getFormattedSessionInfo = useCallback(() => {
    if (!state.sessionInfo) {
      return null;
    }

    return {
      ...state.sessionInfo,
      sessionAgeFormatted: formatTime(state.sessionInfo.sessionAge),
      idleTimeFormatted: formatTime(state.sessionInfo.idleTime),
      timeUntilTimeoutFormatted: formatTime(state.sessionInfo.timeUntilTimeout),
      timeUntilIdleFormatted: formatTime(state.sessionInfo.timeUntilIdle),
    };
  }, [state.sessionInfo, formatTime]);

  return {
    // State
    isMonitoring: state.isMonitoring,
    sessionInfo: state.sessionInfo,
    formattedSessionInfo: getFormattedSessionInfo(),
    showTimeoutWarning: state.showTimeoutWarning,
    showIdleWarning: state.showIdleWarning,
    securityEvents: state.securityEvents,
    
    // Convenience properties for timeout warnings
    timeUntilTimeout: state.sessionInfo?.timeUntilTimeout || 0,
    timeUntilIdle: state.sessionInfo?.timeUntilIdle || 0,

    // Actions
    startMonitoring,
    stopMonitoring,
    extendSession,
    validateSession,
    dismissTimeoutWarning,
    dismissIdleWarning,

    // Utilities
    formatTime,
  };
};

/**
 * Hook for simple session timeout warning
 */
export const useSessionTimeoutWarning = (warningMinutes: number = 5) => {
  const { showTimeoutWarning, timeUntilTimeout, extendSession, dismissTimeoutWarning } = useSessionSecurity({
    enableWarnings: true,
    warningThreshold: warningMinutes,
  });

  return {
    showWarning: showTimeoutWarning,
    timeRemaining: timeUntilTimeout,
    extendSession,
    dismissWarning: dismissTimeoutWarning,
  };
};

/**
 * Hook for idle timeout detection
 */
export const useIdleTimeout = (idleMinutes: number = 30, warningMinutes: number = 2) => {
  const { showIdleWarning, timeUntilIdle, extendSession, dismissIdleWarning } = useSessionSecurity({
    enableWarnings: true,
    idleWarningThreshold: warningMinutes,
  });

  return {
    showWarning: showIdleWarning,
    timeUntilIdle,
    extendSession,
    dismissWarning: dismissIdleWarning,
  };
};