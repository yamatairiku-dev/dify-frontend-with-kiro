import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router';
import {
  ProtectedRoute,
  PermissionProtectedRoute,
  MultiPermissionProtectedRoute,
  RoleProtectedRoute
} from '../ProtectedRoute';
import { User } from '../../types/auth';

// Mock the auth context
const mockUser: User = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  provider: 'azure',
  attributes: {
    domain: 'example.com',
    roles: ['admin', 'user'],
    department: 'Engineering'
  },
  permissions: [
    {
      resource: 'workflow',
      actions: ['execute', 'read'],
      conditions: []
    },
    {
      resource: 'dashboard',
      actions: ['*'],
      conditions: []
    }
  ]
};

const mockAuthContext = {
  user: mockUser,
  isAuthenticated: true,
  isLoading: false,
  login: jest.fn(),
  logout: jest.fn(),
  refreshToken: jest.fn(),
  completeLogin: jest.fn()
};

const mockUnauthenticatedContext = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: jest.fn(),
  logout: jest.fn(),
  refreshToken: jest.fn(),
  completeLogin: jest.fn()
};

const mockLoadingContext = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: jest.fn(),
  logout: jest.fn(),
  refreshToken: jest.fn(),
  completeLogin: jest.fn()
};

// Mock useAuth hook
jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn()
}));

const mockUseAuth = require('../../context/AuthContext').useAuth as jest.MockedFunction<any>;

// Mock navigate function
const mockNavigate = jest.fn();
jest.mock('react-router', () => ({
  ...jest.requireActual('react-router'),
  useNavigate: () => mockNavigate
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<div>{children}</div>} />
      <Route path="/login" element={<div>Login page</div>} />
      <Route path="/access-denied" element={<div>Access denied page</div>} />
    </Routes>
  </BrowserRouter>
);

const TestContent: React.FC = () => <div>Protected content</div>;

describe('ProtectedRoute components', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
  });

  describe('ProtectedRoute', () => {
    it('should render content when user is authenticated', () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <ProtectedRoute>
            <TestContent />
          </ProtectedRoute>
        </TestWrapper>
      );
      
      expect(screen.getByText('Protected content')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should show loading component when authentication is loading', () => {
      mockUseAuth.mockReturnValue(mockLoadingContext);
      
      render(
        <TestWrapper>
          <ProtectedRoute>
            <TestContent />
          </ProtectedRoute>
        </TestWrapper>
      );
      
      expect(screen.getByText('Checking permissions...')).toBeInTheDocument();
      expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    });

    it('should redirect to login when user is not authenticated', async () => {
      mockUseAuth.mockReturnValue(mockUnauthenticatedContext);
      
      render(
        <TestWrapper>
          <ProtectedRoute>
            <TestContent />
          </ProtectedRoute>
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
      });
      
      expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    });

    it('should use custom loading component when provided', () => {
      mockUseAuth.mockReturnValue(mockLoadingContext);
      
      const CustomLoading: React.FC = () => <div>Custom loading...</div>;
      
      render(
        <TestWrapper>
          <ProtectedRoute loadingComponent={CustomLoading}>
            <TestContent />
          </ProtectedRoute>
        </TestWrapper>
      );
      
      expect(screen.getByText('Custom loading...')).toBeInTheDocument();
      expect(screen.queryByText('Checking permissions...')).not.toBeInTheDocument();
    });
  });

  describe('PermissionProtectedRoute', () => {
    it('should render content when user has required permission', () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <PermissionProtectedRoute resource="workflow" action="execute">
            <TestContent />
          </PermissionProtectedRoute>
        </TestWrapper>
      );
      
      expect(screen.getByText('Protected content')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should redirect to access denied when user lacks permission', async () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <PermissionProtectedRoute resource="admin" action="delete">
            <TestContent />
          </PermissionProtectedRoute>
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/access-denied', {
          replace: true,
          state: {
            requiredResource: 'admin',
            requiredAction: 'delete',
            userPermissions: mockUser.permissions
          }
        });
      });
      
      expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    });

    it('should redirect to custom path when specified', async () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <PermissionProtectedRoute 
            resource="admin" 
            action="delete" 
            redirectTo="/custom-denied"
          >
            <TestContent />
          </PermissionProtectedRoute>
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/custom-denied', {
          replace: true,
          state: {
            requiredResource: 'admin',
            requiredAction: 'delete',
            userPermissions: mockUser.permissions
          }
        });
      });
    });

    it('should handle wildcard permissions correctly', () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <PermissionProtectedRoute resource="dashboard" action="write">
            <TestContent />
          </PermissionProtectedRoute>
        </TestWrapper>
      );
      
      expect(screen.getByText('Protected content')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should respect allowWildcard setting', async () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <PermissionProtectedRoute 
            resource="dashboard" 
            action="write" 
            allowWildcard={false}
          >
            <TestContent />
          </PermissionProtectedRoute>
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/access-denied', expect.any(Object));
      });
    });
  });

  describe('MultiPermissionProtectedRoute', () => {
    it('should render content when user has any of the required permissions', () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <MultiPermissionProtectedRoute 
            permissions={[
              { resource: 'admin', action: 'delete' },
              { resource: 'workflow', action: 'execute' }
            ]}
          >
            <TestContent />
          </MultiPermissionProtectedRoute>
        </TestWrapper>
      );
      
      expect(screen.getByText('Protected content')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should redirect when user has none of the required permissions', async () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <MultiPermissionProtectedRoute 
            permissions={[
              { resource: 'admin', action: 'delete' },
              { resource: 'superuser', action: 'manage' }
            ]}
          >
            <TestContent />
          </MultiPermissionProtectedRoute>
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/access-denied', {
          replace: true,
          state: {
            requiredPermissions: [
              { resource: 'admin', action: 'delete' },
              { resource: 'superuser', action: 'manage' }
            ],
            userPermissions: mockUser.permissions
          }
        });
      });
    });
  });

  describe('RoleProtectedRoute', () => {
    it('should render content when user has required role', () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <RoleProtectedRoute roles={['admin']}>
            <TestContent />
          </RoleProtectedRoute>
        </TestWrapper>
      );
      
      expect(screen.getByText('Protected content')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should render content when user has any of the required roles', () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <RoleProtectedRoute roles={['superadmin', 'admin']}>
            <TestContent />
          </RoleProtectedRoute>
        </TestWrapper>
      );
      
      expect(screen.getByText('Protected content')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should redirect when user lacks required role', async () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <RoleProtectedRoute roles={['superadmin']}>
            <TestContent />
          </RoleProtectedRoute>
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/access-denied', {
          replace: true,
          state: {
            requiredRoles: ['superadmin'],
            userRoles: mockUser.attributes.roles
          }
        });
      });
    });

    it('should redirect to custom path when specified', async () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <RoleProtectedRoute roles={['superadmin']} redirectTo="/role-denied">
            <TestContent />
          </RoleProtectedRoute>
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/role-denied', {
          replace: true,
          state: {
            requiredRoles: ['superadmin'],
            userRoles: mockUser.attributes.roles
          }
        });
      });
    });
  });
});