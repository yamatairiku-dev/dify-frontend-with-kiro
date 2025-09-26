// Authentication type definitions
export interface User {
  id: string;
  email: string;
  name: string;
  provider: 'azure' | 'github' | 'google';
  attributes: UserAttributes;
  permissions: Permission[];
}

export interface UserAttributes {
  domain: string;
  roles: string[];
  department?: string;
  organization?: string;
}

export interface Permission {
  resource: string;
  actions: string[];
  conditions?: AccessCondition[];
}

export interface AccessCondition {
  attribute: string;
  operator: 'equals' | 'contains' | 'matches';
  value: string | string[];
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (provider: AuthProviderType) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  completeLogin: (sessionData: SessionData) => Promise<void>;
}

export type AuthProviderType = 'azure' | 'github' | 'google';

export interface OAuthConfig {
  azure: {
    clientId: string;
    tenantId: string;
    redirectUri: string;
    scopes: string[];
  };
  github: {
    clientId: string;
    redirectUri: string;
    scopes: string[];
  };
  google: {
    clientId: string;
    redirectUri: string;
    scopes: string[];
  };
}

// JWT Token Structure
export interface JWTPayload {
  sub: string; // user ID
  email: string;
  name: string;
  provider: string;
  iat: number;
  exp: number;
  permissions: string[];
}

// Session Storage
export interface SessionData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: User;
}

// Authentication state for useReducer
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Authentication actions for useReducer
export type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: User }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'REFRESH_TOKEN_SUCCESS'; payload: User }
  | { type: 'REFRESH_TOKEN_FAILURE' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'CLEAR_ERROR' };