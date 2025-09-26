import { SessionData, JWTPayload, User } from '../types/auth';

// Token storage keys
const TOKEN_STORAGE_KEY = 'dify_auth_session';
const REFRESH_TOKEN_KEY = 'dify_refresh_token';

// Token expiration buffer (5 minutes before actual expiration)
const TOKEN_EXPIRATION_BUFFER = 5 * 60 * 1000; // 5 minutes in milliseconds

// Session timeout (24 hours)
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Secure token management service
 * Handles token storage, validation, refresh, and cleanup
 */
export class TokenManager {
  /**
   * Store session data securely in browser storage
   * Requirement 6.1: Store session data securely in browser storage
   */
  static storeSession(sessionData: SessionData): void {
    try {
      // Store access token and user data in sessionStorage (cleared on tab close)
      const sessionInfo = {
        accessToken: sessionData.accessToken,
        user: sessionData.user,
        expiresAt: sessionData.expiresAt,
        storedAt: Date.now(),
      };
      
      sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(sessionInfo));
      
      // Store refresh token in localStorage (persists across browser sessions)
      // Only store if refresh token is provided
      if (sessionData.refreshToken) {
        const refreshInfo = {
          refreshToken: sessionData.refreshToken,
          storedAt: Date.now(),
        };
        localStorage.setItem(REFRESH_TOKEN_KEY, JSON.stringify(refreshInfo));
      }
    } catch (error) {
      console.error('Failed to store session data:', error);
      throw new Error('Failed to store authentication session');
    }
  }

  /**
   * Retrieve stored session data
   * Requirement 6.2: Restore valid sessions automatically
   */
  static getStoredSession(): SessionData | null {
    try {
      const sessionInfo = sessionStorage.getItem(TOKEN_STORAGE_KEY);
      const refreshInfo = localStorage.getItem(REFRESH_TOKEN_KEY);
      
      if (!sessionInfo) {
        return null;
      }
      
      const parsedSession = JSON.parse(sessionInfo);
      const parsedRefresh = refreshInfo ? JSON.parse(refreshInfo) : null;
      
      // Check if session is too old (beyond session timeout)
      const sessionAge = Date.now() - parsedSession.storedAt;
      if (sessionAge > SESSION_TIMEOUT) {
        this.clearSession();
        return null;
      }
      
      return {
        accessToken: parsedSession.accessToken,
        refreshToken: parsedRefresh?.refreshToken || '',
        expiresAt: parsedSession.expiresAt,
        user: parsedSession.user,
      };
    } catch (error) {
      console.error('Failed to retrieve session data:', error);
      // Clear corrupted session data
      this.clearSession();
      return null;
    }
  }

  /**
   * Check if the current token is valid and not expired
   * Requirement 6.3: Handle token expiration
   */
  static isTokenValid(sessionData: SessionData | null): boolean {
    if (!sessionData || !sessionData.accessToken) {
      return false;
    }
    
    // Check if token is expired (with buffer)
    const now = Date.now();
    const expirationWithBuffer = sessionData.expiresAt - TOKEN_EXPIRATION_BUFFER;
    
    return now < expirationWithBuffer;
  }

  /**
   * Check if token needs refresh (within buffer period)
   */
  static needsRefresh(sessionData: SessionData | null): boolean {
    if (!sessionData || !sessionData.accessToken) {
      return false;
    }
    
    const now = Date.now();
    const expirationWithBuffer = sessionData.expiresAt - TOKEN_EXPIRATION_BUFFER;
    
    // Token is still valid but within refresh buffer
    return now >= expirationWithBuffer && now < sessionData.expiresAt;
  }

  /**
   * Decode JWT token payload (without verification - for client-side use only)
   * Note: This is for extracting user info, not for security validation
   */
  static decodeJWT(token: string): JWTPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }
      
      const payload = parts[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded) as JWTPayload;
    } catch (error) {
      console.error('Failed to decode JWT token:', error);
      return null;
    }
  }

  /**
   * Extract user information from JWT token
   */
  static extractUserFromToken(token: string): User | null {
    const payload = this.decodeJWT(token);
    if (!payload) {
      return null;
    }
    
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      provider: payload.provider as 'azure' | 'github' | 'google',
      attributes: {
        domain: payload.email.split('@')[1] || '',
        roles: [], // Will be populated from backend
        department: undefined,
        organization: undefined,
      },
      permissions: payload.permissions?.map(perm => ({
        resource: perm,
        actions: ['read'], // Default actions, will be expanded
      })) || [],
    };
  }

  /**
   * Update session with new token data
   */
  static updateSession(newSessionData: Partial<SessionData>): void {
    const currentSession = this.getStoredSession();
    if (!currentSession) {
      throw new Error('No existing session to update');
    }
    
    const updatedSession: SessionData = {
      ...currentSession,
      ...newSessionData,
    };
    
    this.storeSession(updatedSession);
  }

  /**
   * Clear all stored session data
   * Requirement 6.4: Clear all session data and revoke tokens
   */
  static clearSession(): void {
    try {
      // Clear session storage
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      
      // Clear refresh token from localStorage
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      
      // Clear any OAuth-related session data
      sessionStorage.removeItem('oauth_state');
      sessionStorage.removeItem('oauth_code_verifier');
      sessionStorage.removeItem('oauth_provider');
    } catch (error) {
      console.error('Failed to clear session data:', error);
      // Continue with logout even if clearing fails
    }
  }

  /**
   * Get the current access token if valid
   */
  static getValidAccessToken(): string | null {
    const session = this.getStoredSession();
    if (!session || !this.isTokenValid(session)) {
      return null;
    }
    return session.accessToken;
  }

  /**
   * Get the refresh token
   */
  static getRefreshToken(): string | null {
    try {
      const refreshInfo = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshInfo) {
        return null;
      }
      
      const parsed = JSON.parse(refreshInfo);
      return parsed.refreshToken || null;
    } catch (error) {
      console.error('Failed to get refresh token:', error);
      return null;
    }
  }

  /**
   * Check for suspicious activity patterns
   * Requirement 6.5: Detect suspicious activity
   */
  static detectSuspiciousActivity(): boolean {
    try {
      const session = this.getStoredSession();
      if (!session) {
        return false;
      }
      
      // Check for rapid token refresh attempts (potential attack)
      const refreshAttempts = this.getRefreshAttempts();
      if (refreshAttempts > 5) {
        console.warn('Suspicious activity detected: Too many refresh attempts');
        return true;
      }
      
      // Check for session age anomalies
      const sessionInfo = sessionStorage.getItem(TOKEN_STORAGE_KEY);
      if (sessionInfo) {
        const parsed = JSON.parse(sessionInfo);
        const sessionAge = Date.now() - parsed.storedAt;
        
        // If session is older than maximum allowed time
        if (sessionAge > SESSION_TIMEOUT) {
          console.warn('Suspicious activity detected: Session too old');
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error detecting suspicious activity:', error);
      return true; // Err on the side of caution
    }
  }

  /**
   * Track refresh attempts for suspicious activity detection
   */
  private static getRefreshAttempts(): number {
    try {
      const attempts = sessionStorage.getItem('refresh_attempts');
      return attempts ? parseInt(attempts, 10) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Increment refresh attempt counter
   */
  static incrementRefreshAttempts(): void {
    try {
      const current = this.getRefreshAttempts();
      sessionStorage.setItem('refresh_attempts', (current + 1).toString());
    } catch (error) {
      console.error('Failed to increment refresh attempts:', error);
    }
  }

  /**
   * Reset refresh attempt counter
   */
  static resetRefreshAttempts(): void {
    try {
      sessionStorage.removeItem('refresh_attempts');
    } catch (error) {
      console.error('Failed to reset refresh attempts:', error);
    }
  }
}