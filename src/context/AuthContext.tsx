import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { AuthContextType, AuthProviderType, User } from '../types/auth';
import { authReducer, initialAuthState } from './authReducer';

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

  // Login function - placeholder implementation
  const login = useCallback(async (provider: AuthProviderType): Promise<void> => {
    dispatch({ type: 'LOGIN_START' });
    
    try {
      // TODO: Implement actual OAuth login logic in task 2.2
      // This is a placeholder that will be implemented in the OAuth provider configurations task
      console.log(`Initiating login with ${provider}`);
      
      // For now, throw an error to indicate this needs to be implemented
      throw new Error('OAuth login not yet implemented');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      dispatch({ type: 'LOGIN_FAILURE', payload: errorMessage });
      throw error;
    }
  }, []);

  // Logout function - placeholder implementation
  const logout = useCallback(async (): Promise<void> => {
    try {
      // TODO: Implement actual logout logic in task 2.3
      // This will include token cleanup and session management
      console.log('Logging out user');
      
      dispatch({ type: 'LOGOUT' });
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, clear the local state
      dispatch({ type: 'LOGOUT' });
    }
  }, []);

  // Refresh token function - placeholder implementation
  const refreshToken = useCallback(async (): Promise<void> => {
    try {
      // TODO: Implement actual token refresh logic in task 2.3
      // This will include automatic token renewal
      console.log('Refreshing authentication token');
      
      // For now, just dispatch failure
      dispatch({ type: 'REFRESH_TOKEN_FAILURE' });
    } catch (error) {
      console.error('Token refresh error:', error);
      dispatch({ type: 'REFRESH_TOKEN_FAILURE' });
    }
  }, []);

  // Initialize authentication state on mount
  useEffect(() => {
    // TODO: Implement session restoration logic in task 2.3
    // This will check for existing valid sessions and restore user state
    console.log('Initializing authentication state');
  }, []);

  // Context value
  const contextValue: AuthContextType = {
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    login,
    logout,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};