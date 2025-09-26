import { authReducer, initialAuthState } from '../authReducer';
import { AuthState, AuthAction, User } from '../../types/auth';

// Mock user data for testing
const mockUser: User = {
  id: '123',
  email: 'test@example.com',
  name: 'Test User',
  provider: 'github',
  attributes: {
    domain: 'example.com',
    roles: ['user'],
  },
  permissions: [],
};

describe('authReducer', () => {
  it('should return initial state', () => {
    const state = authReducer(initialAuthState, { type: 'CLEAR_ERROR' });
    expect(state).toEqual(initialAuthState);
  });

  it('should handle LOGIN_START', () => {
    const action: AuthAction = { type: 'LOGIN_START' };
    const state = authReducer(initialAuthState, action);

    expect(state).toEqual({
      ...initialAuthState,
      isLoading: true,
      error: null,
    });
  });

  it('should handle LOGIN_SUCCESS', () => {
    const action: AuthAction = { type: 'LOGIN_SUCCESS', payload: mockUser };
    const state = authReducer(initialAuthState, action);

    expect(state).toEqual({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
  });

  it('should handle LOGIN_FAILURE', () => {
    const errorMessage = 'Login failed';
    const action: AuthAction = { type: 'LOGIN_FAILURE', payload: errorMessage };
    const state = authReducer(initialAuthState, action);

    expect(state).toEqual({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: errorMessage,
    });
  });

  it('should handle LOGOUT', () => {
    const authenticatedState: AuthState = {
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    };

    const action: AuthAction = { type: 'LOGOUT' };
    const state = authReducer(authenticatedState, action);

    expect(state).toEqual({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  it('should handle REFRESH_TOKEN_SUCCESS', () => {
    const action: AuthAction = { type: 'REFRESH_TOKEN_SUCCESS', payload: mockUser };
    const state = authReducer(initialAuthState, action);

    expect(state).toEqual({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
  });

  it('should handle REFRESH_TOKEN_FAILURE', () => {
    const authenticatedState: AuthState = {
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    };

    const action: AuthAction = { type: 'REFRESH_TOKEN_FAILURE' };
    const state = authReducer(authenticatedState, action);

    expect(state).toEqual({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: 'Token refresh failed',
    });
  });

  it('should handle SET_LOADING', () => {
    const action: AuthAction = { type: 'SET_LOADING', payload: true };
    const state = authReducer(initialAuthState, action);

    expect(state).toEqual({
      ...initialAuthState,
      isLoading: true,
    });
  });

  it('should handle CLEAR_ERROR', () => {
    const stateWithError: AuthState = {
      ...initialAuthState,
      error: 'Some error',
    };

    const action: AuthAction = { type: 'CLEAR_ERROR' };
    const state = authReducer(stateWithError, action);

    expect(state).toEqual({
      ...initialAuthState,
      error: null,
    });
  });
});