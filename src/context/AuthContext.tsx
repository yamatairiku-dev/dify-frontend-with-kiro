import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { AuthContextType, AuthProviderType, User, SessionData } from '../types/auth';
import { authReducer, initialAuthState } from './authReducer';
import { initiateOAuthLogin } from '../utils/oauth-redirect';
import { TokenManager } from '../services/tokenManager';
import { TokenRefreshService } from '../services/tokenRefresh';

// Create the authentication context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom hook to use the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// AuthProvider component props
interface AuthProviderProps {
  children: React.ReactNode;
}

// AuthProvider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialAuthState);

  // Login function - initiates OAuth flow
  const login = useCallback(async (provider: AuthProviderType): Promise<void> => {
    dispatch({ type: 'LOGIN_START' });
    
    try {
      // Initiate OAuth login by redirecting to provider
      await initiateOAuthLogin(provider);
      // Note: The actual login completion happens in the OAuth callback handler
      // This function will redirect the user, so execution stops here
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      dispatch({ type: 'LOGIN_FAILURE', payload: errorMessage });
      throw error;
    }
  }, []);

  // Logout function - complete implementation
  const logout = useCallback(async (): Promise<void> => {
    try {
      // Clear auto refresh timer
      TokenRefreshService.clearAutoRefresh();
      
      // Clear all stored session data and tokens
      TokenManager.clearSession();
      
      // Update authentication state
      dispatch({ type: 'LOGOUT' });
      
      console.log('User logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, clear the local state and session
      TokenManager.clearSession();
      dispatch({ type: 'LOGOUT' });
    }
  }, []);

  // Refresh token function - complete implementation
  const refreshToken = useCallback(async (): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const refreshedSession = await TokenRefreshService.refreshAccessToken();
      
      if (refreshedSession && refreshedSession.user) {
        dispatch({ type: 'REFRESH_TOKEN_SUCCESS', payload: refreshedSession.user });
        
        // Set up auto refresh for the new token
        TokenRefreshService.setupAutoRefresh();
        
        console.log('Token refreshed successfully');
      } else {
        dispatch({ type: 'REFRESH_TOKEN_FAILURE' });
        console.warn('Token refresh failed - user will need to re-authenticate');
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      dispatch({ type: 'REFRESH_TOKEN_FAILURE' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  // Complete OAuth login after successful authentication
  const completeLogin = useCallback(async (sessionData: SessionData): Promise<void> => {
    try {
      // Store the session data securely
      TokenManager.storeSession(sessionData);
      
      // Update authentication state
      dispatch({ type: 'LOGIN_SUCCESS', payload: sessionData.user });
      
      // Set up automatic token refresh
      TokenRefreshService.setupAutoRefresh();
      
      console.log('Login completed successfully');
    } catch (error) {
      console.error('Login completion error:', error);
      dispatch({ type: 'LOGIN_FAILURE', payload: 'Failed to complete login' });
      throw error;
    }
  }, []);

  // Initialize authentication state on mount
  useEffect(() => {
    const initializeAuth = async (): Promise<void> => {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      try {
        // Validate existing session and refresh if needed
        const { isValid, user } = await TokenRefreshService.validateAndRefreshSession();
        
        if (isValid && user) {
          dispatch({ type: 'LOGIN_SUCCESS', payload: user });
          
          // Set up automatic token refresh
          TokenRefreshService.setupAutoRefresh();
          
          console.log('Session restored successfully');
        } else {
          // No valid session found
          dispatch({ type: 'LOGOUT' });
          console.log('No valid session found');
        }
      } catch (error) {
        console.error('Session initialization error:', error);
        dispatch({ type: 'LOGOUT' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    initializeAuth();
  }, []);

  // Context value
  const contextValue: AuthContextType = {
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    login,
    logout,
    refreshToken,
    completeLogin,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};