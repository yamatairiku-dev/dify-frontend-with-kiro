import { TokenManager } from './tokenManager';
import { SessionData, User } from '../types/auth';

// Token refresh endpoint (will be configured based on environment)
const TOKEN_REFRESH_ENDPOINT = '/api/auth/refresh';

/**
 * Token refresh service
 * Handles automatic token renewal and refresh logic
 */
export class TokenRefreshService {
  private static refreshPromise: Promise<SessionData> | null = null;
  private static refreshTimer: NodeJS.Timeout | null = null;

  /**
   * Attempt to refresh the access token using refresh token
   * Requirement 6.2: Automatic token renewal
   */
  static async refreshAccessToken(): Promise<SessionData | null> {
    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = TokenManager.getRefreshToken();
    if (!refreshToken) {
      console.warn('No refresh token available');
      return null;
    }

    // Track refresh attempts for suspicious activity detection
    TokenManager.incrementRefreshAttempts();

    this.refreshPromise = this.performTokenRefresh(refreshToken);

    try {
      const result = await this.refreshPromise;
      TokenManager.resetRefreshAttempts();
      return result;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Perform the actual token refresh API call
   */
  private static async performTokenRefresh(refreshToken: string): Promise<SessionData> {
    try {
      // In a real implementation, this would call your backend API
      // For now, we'll simulate the refresh process
      const response = await fetch(TOKEN_REFRESH_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Extract new session data from response
      const newSessionData: SessionData = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || refreshToken, // Use new refresh token if provided
        expiresAt: data.expiresAt || (Date.now() + (60 * 60 * 1000)), // Default 1 hour
        user: data.user,
      };

      // Store the new session data
      TokenManager.storeSession(newSessionData);

      return newSessionData;
    } catch (error) {
      // If refresh fails, clear the session
      TokenManager.clearSession();
      throw error;
    }
  }

  /**
   * Set up automatic token refresh timer
   * Schedules refresh before token expires
   */
  static setupAutoRefresh(): void {
    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    const session = TokenManager.getStoredSession();
    if (!session || !TokenManager.isTokenValid(session)) {
      return;
    }

    // Calculate time until refresh is needed (5 minutes before expiration)
    const now = Date.now();
    const timeUntilRefresh = session.expiresAt - now - (5 * 60 * 1000); // 5 minutes buffer

    if (timeUntilRefresh > 0) {
      this.refreshTimer = setTimeout(async () => {
        try {
          await this.refreshAccessToken();
          // Set up next refresh cycle
          this.setupAutoRefresh();
        } catch (error) {
          console.error('Auto refresh failed:', error);
          // Don't set up next refresh if this one failed
        }
      }, timeUntilRefresh);
    }
  }

  /**
   * Clear the auto refresh timer
   */
  static clearAutoRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Check if token needs refresh and perform it if necessary
   */
  static async checkAndRefreshToken(): Promise<boolean> {
    const session = TokenManager.getStoredSession();
    
    if (!session) {
      return false;
    }

    // If token is still valid, no refresh needed
    if (TokenManager.isTokenValid(session)) {
      return true;
    }

    // If token needs refresh, attempt it
    if (TokenManager.needsRefresh(session)) {
      const refreshedSession = await this.refreshAccessToken();
      return refreshedSession !== null;
    }

    // Token is expired and cannot be refreshed
    return false;
  }

  /**
   * Validate session and refresh if needed
   * Returns true if session is valid after potential refresh
   */
  static async validateAndRefreshSession(): Promise<{ isValid: boolean; user: User | null }> {
    // Check for suspicious activity first
    if (TokenManager.detectSuspiciousActivity()) {
      TokenManager.clearSession();
      return { isValid: false, user: null };
    }

    const session = TokenManager.getStoredSession();
    
    if (!session) {
      return { isValid: false, user: null };
    }

    // If token is valid, return user
    if (TokenManager.isTokenValid(session)) {
      return { isValid: true, user: session.user };
    }

    // Try to refresh if possible
    const refreshResult = await this.checkAndRefreshToken();
    
    if (refreshResult) {
      const refreshedSession = TokenManager.getStoredSession();
      return { 
        isValid: true, 
        user: refreshedSession?.user || null 
      };
    }

    // Session cannot be restored
    TokenManager.clearSession();
    return { isValid: false, user: null };
  }
}