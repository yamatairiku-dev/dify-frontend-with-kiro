/**
 * Enhanced Session Security Service
 * Implements comprehensive session security features including timeout, 
 * suspicious activity detection, and session management
 */

import { TokenManager } from './tokenManager';
import { TokenRefreshService } from './tokenRefresh';
import { User, SessionData } from '../types/auth';

// Session security configuration
interface SessionSecurityConfig {
  sessionTimeout: number; // Maximum session duration (24 hours)
  idleTimeout: number; // Idle timeout (30 minutes)
  maxRefreshAttempts: number; // Maximum refresh attempts before lockout
  suspiciousActivityThreshold: number; // Threshold for suspicious activity detection
  sessionWarningTime: number; // Time before session expires to show warning (5 minutes)
  maxConcurrentSessions: number; // Maximum concurrent sessions per user
  enableActivityTracking: boolean; // Track user activity for idle detection
}

// Default configuration
const DEFAULT_CONFIG: SessionSecurityConfig = {
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
  idleTimeout: 30 * 60 * 1000, // 30 minutes
  maxRefreshAttempts: 5,
  suspiciousActivityThreshold: 10,
  sessionWarningTime: 5 * 60 * 1000, // 5 minutes
  maxConcurrentSessions: 3,
  enableActivityTracking: true,
};

// Session activity tracking
interface SessionActivity {
  lastActivity: number;
  activityCount: number;
  refreshAttempts: number;
  loginAttempts: number;
  failedOperations: number;
  ipAddress?: string;
  userAgent?: string;
  sessionStartTime: number;
  warningShown: boolean;
}

// Session security events
export enum SessionSecurityEvent {
  SESSION_TIMEOUT = 'SESSION_TIMEOUT',
  IDLE_TIMEOUT = 'IDLE_TIMEOUT',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  SESSION_WARNING = 'SESSION_WARNING',
  SESSION_RESTORED = 'SESSION_RESTORED',
  SESSION_INVALIDATED = 'SESSION_INVALIDATED',
  CONCURRENT_SESSION_DETECTED = 'CONCURRENT_SESSION_DETECTED',
}

// Event listener type
export type SessionSecurityEventListener = (event: SessionSecurityEvent, data?: any) => void;

/**
 * Enhanced Session Security Service
 */
export class SessionSecurityService {
  private static config: SessionSecurityConfig = DEFAULT_CONFIG;
  private static activity: SessionActivity | null = null;
  private static timeoutTimer: NodeJS.Timeout | null = null;
  private static idleTimer: NodeJS.Timeout | null = null;
  private static warningTimer: NodeJS.Timeout | null = null;
  private static eventListeners: Map<SessionSecurityEvent, SessionSecurityEventListener[]> = new Map();
  private static isInitialized = false;

  /**
   * Initialize session security service
   */
  static initialize(customConfig?: Partial<SessionSecurityConfig>): void {
    if (this.isInitialized) {
      return;
    }

    // Merge custom configuration
    if (customConfig) {
      this.config = { ...DEFAULT_CONFIG, ...customConfig };
    }

    // Initialize activity tracking
    this.initializeActivityTracking();

    // Set up event listeners for user activity
    if (this.config.enableActivityTracking) {
      this.setupActivityListeners();
    }

    // Check for existing session and restore if valid
    this.restoreSession();

    this.isInitialized = true;
    console.log('Session security service initialized');
  }

  /**
   * Start session security monitoring for authenticated user
   */
  static startSessionMonitoring(user: User): void {
    // Initialize activity tracking
    this.activity = {
      lastActivity: Date.now(),
      activityCount: 0,
      refreshAttempts: 0,
      loginAttempts: 0,
      failedOperations: 0,
      sessionStartTime: Date.now(),
      warningShown: false,
    };

    // Store session metadata
    this.storeSessionMetadata(user);

    // Set up session timeout
    this.setupSessionTimeout();

    // Set up idle timeout
    this.setupIdleTimeout();

    // Set up session warning
    this.setupSessionWarning();

    console.log('Session monitoring started for user:', user.email);
  }

  /**
   * Stop session security monitoring
   */
  static stopSessionMonitoring(): void {
    // Clear all timers
    this.clearAllTimers();

    // Clear activity tracking
    this.activity = null;

    // Clear session metadata
    this.clearSessionMetadata();

    console.log('Session monitoring stopped');
  }

  /**
   * Update user activity timestamp
   */
  static updateActivity(): void {
    if (!this.activity) {
      return;
    }

    const now = Date.now();
    this.activity.lastActivity = now;
    this.activity.activityCount++;

    // Reset idle timer
    this.setupIdleTimeout();

    // Store activity in session storage for cross-tab synchronization
    try {
      sessionStorage.setItem('session_activity', JSON.stringify({
        lastActivity: now,
        activityCount: this.activity.activityCount,
      }));
    } catch (error) {
      console.warn('Failed to store activity data:', error);
    }
  }

  /**
   * Check for suspicious activity patterns
   */
  static detectSuspiciousActivity(): boolean {
    if (!this.activity) {
      return false;
    }

    const suspiciousIndicators = [];

    // Check excessive refresh attempts
    if (this.activity.refreshAttempts > this.config.maxRefreshAttempts) {
      suspiciousIndicators.push('Excessive refresh attempts');
    }

    // Check rapid activity patterns (potential bot behavior)
    const activityRate = this.activity.activityCount / ((Date.now() - this.activity.sessionStartTime) / 1000);
    if (activityRate > this.config.suspiciousActivityThreshold) {
      suspiciousIndicators.push('Abnormally high activity rate');
    }

    // Check session age anomalies
    const sessionAge = Date.now() - this.activity.sessionStartTime;
    if (sessionAge > this.config.sessionTimeout) {
      suspiciousIndicators.push('Session exceeded maximum duration');
    }

    // Check for failed operations pattern
    if (this.activity.failedOperations > 10) {
      suspiciousIndicators.push('Excessive failed operations');
    }

    // Check for concurrent sessions
    if (this.detectConcurrentSessions()) {
      suspiciousIndicators.push('Multiple concurrent sessions detected');
    }

    if (suspiciousIndicators.length > 0) {
      console.warn('Suspicious activity detected:', suspiciousIndicators);
      this.emitEvent(SessionSecurityEvent.SUSPICIOUS_ACTIVITY, { indicators: suspiciousIndicators });
      return true;
    }

    return false;
  }

  /**
   * Detect concurrent sessions from the same user
   */
  private static detectConcurrentSessions(): boolean {
    try {
      const sessionId = this.generateSessionId();
      const storedSessions = localStorage.getItem('active_sessions');
      
      if (!storedSessions) {
        // First session, store it
        localStorage.setItem('active_sessions', JSON.stringify([sessionId]));
        return false;
      }

      const sessions = JSON.parse(storedSessions);
      
      // Clean up old sessions (older than session timeout)
      const now = Date.now();
      const validSessions = sessions.filter((session: any) => {
        return (now - session.timestamp) < this.config.sessionTimeout;
      });

      // Check if current session is already tracked
      const currentSessionExists = validSessions.some((session: any) => session.id === sessionId);
      
      if (!currentSessionExists) {
        validSessions.push({ id: sessionId, timestamp: now });
        localStorage.setItem('active_sessions', JSON.stringify(validSessions));
      }

      // Check if we exceed maximum concurrent sessions
      return validSessions.length > this.config.maxConcurrentSessions;
    } catch (error) {
      console.warn('Failed to detect concurrent sessions:', error);
      return false;
    }
  }

  /**
   * Generate unique session identifier
   */
  private static generateSessionId(): string {
    // Use a combination of timestamp, random values, and browser fingerprint
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2);
    const fingerprint = this.getBrowserFingerprint();
    
    return btoa(`${timestamp}-${random}-${fingerprint}`).substring(0, 32);
  }

  /**
   * Get basic browser fingerprint for session identification
   */
  private static getBrowserFingerprint(): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Browser fingerprint', 2, 2);
    }
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL(),
    ].join('|');
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  /**
   * Invalidate session due to security concerns
   */
  static invalidateSession(reason: string): void {
    console.warn('Session invalidated:', reason);
    
    // Clear all session data
    TokenManager.clearSession();
    this.stopSessionMonitoring();
    
    // Emit invalidation event
    this.emitEvent(SessionSecurityEvent.SESSION_INVALIDATED, { reason });
  }

  /**
   * Check session health and perform security validations
   */
  static async validateSessionSecurity(): Promise<{ isValid: boolean; reason?: string }> {
    // Check if session monitoring is active
    if (!this.activity) {
      return { isValid: false, reason: 'No active session monitoring' };
    }

    // Check for suspicious activity
    if (this.detectSuspiciousActivity()) {
      this.invalidateSession('Suspicious activity detected');
      return { isValid: false, reason: 'Suspicious activity detected' };
    }

    // Check session timeout
    const sessionAge = Date.now() - this.activity.sessionStartTime;
    if (sessionAge > this.config.sessionTimeout) {
      this.invalidateSession('Session timeout exceeded');
      this.emitEvent(SessionSecurityEvent.SESSION_TIMEOUT);
      return { isValid: false, reason: 'Session timeout' };
    }

    // Check idle timeout
    const idleTime = Date.now() - this.activity.lastActivity;
    if (idleTime > this.config.idleTimeout) {
      this.invalidateSession('Idle timeout exceeded');
      this.emitEvent(SessionSecurityEvent.IDLE_TIMEOUT);
      return { isValid: false, reason: 'Idle timeout' };
    }

    // Validate token integrity
    const session = TokenManager.getStoredSession();
    if (!session || !TokenManager.isTokenValid(session)) {
      // Try to refresh token
      try {
        const refreshResult = await TokenRefreshService.refreshAccessToken();
        if (!refreshResult) {
          return { isValid: false, reason: 'Token refresh failed' };
        }
        this.activity.refreshAttempts++;
      } catch (error) {
        this.activity.failedOperations++;
        return { isValid: false, reason: 'Token validation failed' };
      }
    }

    return { isValid: true };
  }

  /**
   * Get session information for UI display
   */
  static getSessionInfo(): {
    isActive: boolean;
    sessionAge: number;
    idleTime: number;
    timeUntilTimeout: number;
    timeUntilIdle: number;
    activityCount: number;
    refreshAttempts: number;
    sessionStartTime: number;
  } | null {
    if (!this.activity) {
      return null;
    }

    const now = Date.now();
    const sessionAge = now - this.activity.sessionStartTime;
    const idleTime = now - this.activity.lastActivity;
    const timeUntilTimeout = Math.max(0, this.config.sessionTimeout - sessionAge);
    const timeUntilIdle = Math.max(0, this.config.idleTimeout - idleTime);

    return {
      isActive: true,
      sessionAge,
      idleTime,
      timeUntilTimeout,
      timeUntilIdle,
      activityCount: this.activity.activityCount,
      refreshAttempts: this.activity.refreshAttempts,
      sessionStartTime: this.activity.sessionStartTime,
    };
  }

  /**
   * Extend session (reset idle timer)
   */
  static extendSession(): void {
    if (!this.activity) {
      return;
    }

    this.updateActivity();
    console.log('Session extended');
  }

  /**
   * Add event listener for session security events
   */
  static addEventListener(event: SessionSecurityEvent, listener: SessionSecurityEventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  /**
   * Remove event listener
   */
  static removeEventListener(event: SessionSecurityEvent, listener: SessionSecurityEventListener): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit session security event
   */
  private static emitEvent(event: SessionSecurityEvent, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event, data);
        } catch (error) {
          console.error('Error in session security event listener:', error);
        }
      });
    }
  }

  /**
   * Initialize activity tracking from stored data
   */
  private static initializeActivityTracking(): void {
    try {
      const storedActivity = sessionStorage.getItem('session_activity');
      if (storedActivity) {
        const parsed = JSON.parse(storedActivity);
        // Restore activity if recent (within idle timeout)
        const timeSinceActivity = Date.now() - parsed.lastActivity;
        if (timeSinceActivity < this.config.idleTimeout) {
          // Activity is recent, we can restore some state
          console.log('Restored recent activity data');
        }
      }
    } catch (error) {
      console.warn('Failed to restore activity data:', error);
    }
  }

  /**
   * Set up event listeners for user activity detection
   */
  private static setupActivityListeners(): void {
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const throttledUpdateActivity = this.throttle(() => {
      this.updateActivity();
    }, 1000); // Throttle to once per second

    activityEvents.forEach(event => {
      document.addEventListener(event, throttledUpdateActivity, { passive: true });
    });

    // Listen for visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.updateActivity();
      }
    });

    // Listen for storage events (cross-tab activity)
    window.addEventListener('storage', (event) => {
      if (event.key === 'session_activity' && event.newValue) {
        try {
          const activityData = JSON.parse(event.newValue);
          if (this.activity) {
            this.activity.lastActivity = Math.max(this.activity.lastActivity, activityData.lastActivity);
          }
        } catch (error) {
          console.warn('Failed to sync cross-tab activity:', error);
        }
      }
    });
  }

  /**
   * Set up session timeout timer
   */
  private static setupSessionTimeout(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
    }

    this.timeoutTimer = setTimeout(() => {
      this.invalidateSession('Session timeout reached');
      this.emitEvent(SessionSecurityEvent.SESSION_TIMEOUT);
    }, this.config.sessionTimeout);
  }

  /**
   * Set up idle timeout timer
   */
  private static setupIdleTimeout(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    this.idleTimer = setTimeout(() => {
      this.invalidateSession('Idle timeout reached');
      this.emitEvent(SessionSecurityEvent.IDLE_TIMEOUT);
    }, this.config.idleTimeout);
  }

  /**
   * Set up session warning timer
   */
  private static setupSessionWarning(): void {
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
    }

    const warningTime = this.config.sessionTimeout - this.config.sessionWarningTime;
    
    this.warningTimer = setTimeout(() => {
      if (this.activity && !this.activity.warningShown) {
        this.activity.warningShown = true;
        this.emitEvent(SessionSecurityEvent.SESSION_WARNING, {
          timeRemaining: this.config.sessionWarningTime,
        });
      }
    }, warningTime);
  }

  /**
   * Clear all security timers
   */
  private static clearAllTimers(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
  }

  /**
   * Store session metadata for security tracking
   */
  private static storeSessionMetadata(user: User): void {
    try {
      const metadata = {
        userId: user.id,
        email: user.email,
        sessionStart: Date.now(),
        userAgent: navigator.userAgent,
        fingerprint: this.getBrowserFingerprint(),
      };
      
      sessionStorage.setItem('session_metadata', JSON.stringify(metadata));
    } catch (error) {
      console.warn('Failed to store session metadata:', error);
    }
  }

  /**
   * Clear session metadata
   */
  private static clearSessionMetadata(): void {
    try {
      sessionStorage.removeItem('session_metadata');
      sessionStorage.removeItem('session_activity');
      localStorage.removeItem('active_sessions');
    } catch (error) {
      console.warn('Failed to clear session metadata:', error);
    }
  }

  /**
   * Restore session from stored data
   */
  private static async restoreSession(): Promise<void> {
    try {
      // Validate and restore session using existing token services
      const { isValid, user } = await TokenRefreshService.validateAndRefreshSession();
      
      if (isValid && user) {
        // Check session metadata for security validation
        const metadata = sessionStorage.getItem('session_metadata');
        if (metadata) {
          const parsed = JSON.parse(metadata);
          
          // Validate session integrity
          if (parsed.userId === user.id && parsed.userAgent === navigator.userAgent) {
            // Session appears valid, start monitoring
            this.startSessionMonitoring(user);
            this.emitEvent(SessionSecurityEvent.SESSION_RESTORED, { user });
            console.log('Session restored successfully');
          } else {
            console.warn('Session metadata mismatch, invalidating session');
            this.invalidateSession('Session metadata validation failed');
          }
        } else {
          // No metadata, treat as new session
          this.startSessionMonitoring(user);
        }
      }
    } catch (error) {
      console.error('Session restoration failed:', error);
      this.invalidateSession('Session restoration error');
    }
  }

  /**
   * Throttle function to limit function calls
   */
  private static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return function (this: any, ...args: Parameters<T>) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  /**
   * Update configuration
   */
  static updateConfig(newConfig: Partial<SessionSecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Session security configuration updated');
  }

  /**
   * Get current configuration
   */
  static getConfig(): SessionSecurityConfig {
    return { ...this.config };
  }
}