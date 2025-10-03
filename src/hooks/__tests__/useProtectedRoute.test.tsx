import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router';
import { AuthProvider } from '../../context/AuthContext';
import {
  useAuthRequired,
  usePermissionRequired,
  useAnyPermissionRequired,
  usePermissionCheck,
  useMultiplePermissionCheck,
  useRoleRequired
} from '../useProtectedRoute';
import { User, Permission } from '../../types/auth';

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

// Test components
const TestAuthRequired: React.FC = () => {
  const { isLoading, isAuthenticated } = useAuthRequired();
  
  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Not authenticated</div>;
  
  return <div>Authenticated content</div>;
};

const TestPermissionRequired: React.FC<{ resource: string; action: string }> = ({ resource, action }) => {
  const { isLoading, isAuthenticated, hasPermission } = usePermissionRequired({
    resource,
    action
  });
  
  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Not authenticated</div>;
  if (!hasPermission) return <div>No permission</div>;
  
  return <div>Has permission</div>;
};

const TestPermissionCheck: React.FC<{ resource: string; action: string }> = ({ resource, action }) => {
  const hasPermission = usePermissionCheck(resource, action);
  
  return <div>{hasPermission ? 'Has permission' : 'No permission'}</div>;
};

const TestMultiplePermissionCheck: React.FC = () => {
  const permissions = useMultiplePermissionCheck([
    { resource: 'workflow', action: 'execute' },
    { resource: 'dashboard', action: 'read' },
    { resource: 'admin', action: 'write' }
  ]);
  
  return (
    <div>
      <div data-testid="workflow-execute">{permissions['workflow:execute'] ? 'Yes' : 'No'}</div>
      <div data-testid="dashboard-read">{permissions['dashboard:read'] ? 'Yes' : 'No'}</div>
      <div data-testid="admin-write">{permissions['admin:write'] ? 'Yes' : 'No'}</div>
    </div>
  );
};

const TestRoleRequired: React.FC<{ roles: string[] }> = ({ roles }) => {
  const { isLoading, isAuthenticated, hasRequiredRole } = useRoleRequired(roles);
  
  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Not authenticated</div>;
  if (!hasRequiredRole) return <div>No required role</div>;
  
  return <div>Has required role</div>;
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<div>{children}</div>} />
      <Route path="/login" element={<div>Login page</div>} />
      <Route path="/access-denied" element={<div>Access denied page</div>} />
    </Routes>
  </BrowserRouter>
);

describe('useProtectedRoute hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
  });

  describe('useAuthRequired', () => {
    it('should allow access when user is authenticated', () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <TestAuthRequired />
        </TestWrapper>
      );
      
      expect(screen.getByText('Authenticated content')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should redirect to login when user is not authenticated', async () => {
      mockUseAuth.mockReturnValue(mockUnauthenticatedContext);
      
      render(
        <TestWrapper>
          <TestAuthRequired />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
      });
    });

    it('should show loading state when authentication is loading', () => {
      mockUseAuth.mockReturnValue(mockLoadingContext);
      
      render(
        <TestWrapper>
          <TestAuthRequired />
        </TestWrapper>
      );
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('usePermissionRequired', () => {
    it('should allow access when user has required permission', () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <TestPermissionRequired resource="workflow" action="execute" />
        </TestWrapper>
      );
      
      expect(screen.getByText('Has permission')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should redirect to access denied when user lacks permission', async () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <TestPermissionRequired resource="admin" action="delete" />
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
    });

    it('should allow access with wildcard permissions', () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <TestPermissionRequired resource="dashboard" action="read" />
        </TestWrapper>
      );
      
      expect(screen.getByText('Has permission')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should redirect to login when user is not authenticated', async () => {
      mockUseAuth.mockReturnValue(mockUnauthenticatedContext);
      
      render(
        <TestWrapper>
          <TestPermissionRequired resource="workflow" action="execute" />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
      });
    });
  });

  describe('usePermissionCheck', () => {
    it('should return true when user has permission', () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <TestPermissionCheck resource="workflow" action="execute" />
        </TestWrapper>
      );
      
      expect(screen.getByText('Has permission')).toBeInTheDocument();
    });

    it('should return false when user lacks permission', () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <TestPermissionCheck resource="admin" action="delete" />
        </TestWrapper>
      );
      
      expect(screen.getByText('No permission')).toBeInTheDocument();
    });

    it('should return false when user is not authenticated', () => {
      mockUseAuth.mockReturnValue(mockUnauthenticatedContext);
      
      render(
        <TestWrapper>
          <TestPermissionCheck resource="workflow" action="execute" />
        </TestWrapper>
      );
      
      expect(screen.getByText('No permission')).toBeInTheDocument();
    });

    it('should handle wildcard permissions correctly', () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <TestPermissionCheck resource="dashboard" action="write" />
        </TestWrapper>
      );
      
      expect(screen.getByText('Has permission')).toBeInTheDocument();
    });
  });

  describe('useMultiplePermissionCheck', () => {
    it('should check multiple permissions correctly', () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <TestMultiplePermissionCheck />
        </TestWrapper>
      );
      
      expect(screen.getByTestId('workflow-execute')).toHaveTextContent('Yes');
      expect(screen.getByTestId('dashboard-read')).toHaveTextContent('Yes');
      expect(screen.getByTestId('admin-write')).toHaveTextContent('No');
    });

    it('should return false for all permissions when user is not authenticated', () => {
      mockUseAuth.mockReturnValue(mockUnauthenticatedContext);
      
      render(
        <TestWrapper>
          <TestMultiplePermissionCheck />
        </TestWrapper>
      );
      
      expect(screen.getByTestId('workflow-execute')).toHaveTextContent('No');
      expect(screen.getByTestId('dashboard-read')).toHaveTextContent('No');
      expect(screen.getByTestId('admin-write')).toHaveTextContent('No');
    });
  });

  describe('useRoleRequired', () => {
    it('should allow access when user has required role', () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <TestRoleRequired roles={['admin']} />
        </TestWrapper>
      );
      
      expect(screen.getByText('Has required role')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should allow access when user has any of the required roles', () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <TestRoleRequired roles={['superadmin', 'admin']} />
        </TestWrapper>
      );
      
      expect(screen.getByText('Has required role')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should redirect to access denied when user lacks required role', async () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <TestRoleRequired roles={['superadmin']} />
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

    it('should redirect to login when user is not authenticated', async () => {
      mockUseAuth.mockReturnValue(mockUnauthenticatedContext);
      
      render(
        <TestWrapper>
          <TestRoleRequired roles={['admin']} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
      });
    });
  });

  describe('useAnyPermissionRequired', () => {
    it('should allow access when user has any of the required permissions', () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      const TestAnyPermission: React.FC = () => {
        const { isLoading, isAuthenticated, hasAnyPermission } = useAnyPermissionRequired([
          { resource: 'admin', action: 'delete' },
          { resource: 'workflow', action: 'execute' }
        ]);
        
        if (isLoading) return <div>Loading...</div>;
        if (!isAuthenticated) return <div>Not authenticated</div>;
        if (!hasAnyPermission) return <div>No permission</div>;
        
        return <div>Has any permission</div>;
      };
      
      render(
        <TestWrapper>
          <TestAnyPermission />
        </TestWrapper>
      );
      
      expect(screen.getByText('Has any permission')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should redirect when user has none of the required permissions', async () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      const TestAnyPermission: React.FC = () => {
        const { isLoading, isAuthenticated, hasAnyPermission } = useAnyPermissionRequired([
          { resource: 'admin', action: 'delete' },
          { resource: 'superuser', action: 'manage' }
        ]);
        
        if (isLoading) return <div>Loading...</div>;
        if (!isAuthenticated) return <div>Not authenticated</div>;
        if (!hasAnyPermission) return <div>No permission</div>;
        
        return <div>Has any permission</div>;
      };
      
      render(
        <TestWrapper>
          <TestAnyPermission />
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
});