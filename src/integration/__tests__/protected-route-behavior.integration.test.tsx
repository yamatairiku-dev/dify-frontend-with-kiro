/**
 * Integration tests for protected route behavior
 * Tests complete routing system with authentication and authorization
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { Layout, ProtectedLayout, PublicLayout } from '../../components/Layout';
import { Navigation } from '../../components/Navigation';
import { RouteErrorBoundary } from '../../components/RouteErrorBoundary';
import { User, SessionData } from '../../types/auth';
import { AccessControlService } from '../../services/accessControlService';

// Mock services
jest.mock('../../services/tokenManager');
jest.mock('../../services/tokenRefresh');
jest.mock('../../services/accessControlService');

const mockAccessControlService = AccessControlService as jest.Mocked<typeof AccessControlService>;

// Test users with different permission levels
const adminUser: User = {
  id: 'admin-id',
  email: 'admin@company.com',
  name: 'Admin User',
  provider: 'azure',
  attributes: {
    domain: 'company.com',
    roles: ['admin', 'user'],
    department: 'IT'
  },
  permissions: [
    {
      resource: '*',
      actions: ['*'],
      conditions: []
    }
  ]
};

const managerUser: User = {
  id: 'manager-id',
  email: 'manager@company.com',
  name: 'Manager User',
  provider: 'github',
  attributes: {
    domain: 'company.com',
    roles: ['manager', 'user'],
    department: 'Operations'
  },
  permissions: [
    {
      resource: 'workflow',
      actions: ['read', 'execute', 'manage'],
      conditions: []
    },
    {
      resource: 'reports',
      actions: ['read', 'generate'],
      conditions: []
    }
  ]
};

const regularUser: User = {
  id: 'user-id',
  email: 'user@company.com',
  name: 'Regular User',
  provider: 'google',
  attributes: {
    domain: 'company.com',
    roles: ['user'],
    department: 'Engineering'
  },
  permissions: [
    {
      resource: 'workflow',
      actions: ['read', 'execute'],
      conditions: []
    }
  ]
};

const restrictedUser: User = {
  id: 'restricted-id',
  email: 'restricted@external.com',
  name: 'Restricted User',
  provider: 'google',
  attributes: {
    domain: 'external.com',
    roles: ['guest'],
    department: 'External'
  },
  permissions: [
    {
      resource: 'workflow',
      actions: ['read'],
      conditions: [
        {
          attribute: 'category',
          operator: 'equals',
          value: 'public'
        }
      ]
    }
  ]
};

// Test components
const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome, {user?.name}</p>
      <div data-testid="user-permissions">
        {user?.permissions.map((perm, index) => (
          <div key={index}>
            {perm.resource}: {perm.actions.join(', ')}
          </div>
        ))}
      </div>
    </div>
  );
};

const WorkflowListPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleExecuteWorkflow = (workflowId: string) => {
    navigate(`/workflows/${workflowId}`);
  };

  return (
    <div>
      <h1>Workflows</h1>
      <p>Available workflows for {user?.name}</p>
      <button onClick={() => handleExecuteWorkflow('test-workflow')}>
        Execute Test Workflow
      </button>
      <button onClick={() => handleExecuteWorkflow('admin-workflow')}>
        Execute Admin Workflow
      </button>
    </div>
  );
};

const WorkflowExecutionPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const workflowId = location.pathname.split('/').pop();

  return (
    <div>
      <h1>Execute Workflow: {workflowId}</h1>
      <p>User: {user?.name}</p>
      <div data-testid="workflow-execution">
        <input placeholder="Workflow input" />
        <button>Execute</button>
      </div>
    </div>
  );
};

const AdminPage: React.FC = () => {
  const { user } = useAuth();
  return (
    <div>
      <h1>Admin Panel</h1>
      <p>Admin user: {user?.name}</p>
      <div data-testid="admin-controls">
        <button>Manage Users</button>
        <button>System Settings</button>
      </div>
    </div>
  );
};

const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  return (
    <div>
      <h1>Reports</h1>
      <p>Reports for: {user?.name}</p>
      <div data-testid="reports-list">
        <div>Workflow Usage Report</div>
        <div>Performance Report</div>
      </div>
    </div>
  );
};

const LoginPage: React.FC = () => {
  return (
    <div>
      <h1>Login Required</h1>
      <p>Please authenticate to access this application</p>
      <div data-testid="login-options">
        <button>Login with Azure</button>
        <button>Login with GitHub</button>
        <button>Login with Google</button>
      </div>
    </div>
  );
};

const AccessDeniedPage: React.FC = () => {
  const location = useLocation();
  const state = location.state as any;
  
  return (
    <div>
      <h1>Access Denied</h1>
      <p>You don't have permission to access this resource</p>
      {state?.requiredPermissions && (
        <div data-testid="required-permissions">
          <h3>Required Permissions:</h3>
          {state.requiredPermissions.map((perm: string, index: number) => (
            <div key={index}>{perm}</div>
          ))}
        </div>
      )}
      <button onClick={() => window.history.back()}>Go Back</button>
    </div>
  );
};

// Permission-protected route wrapper
const PermissionProtectedRoute: React.FC<{
  children: React.ReactNode;
  resource: string;
  action: string;
  requiredRoles?: string[];
}> = ({ children, resource, action, requiredRoles }) => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }

    if (!user) return;

    // Check permissions
    const hasPermission = user.permissions.some(permission => {
      const resourceMatch = permission.resource === resource || permission.resource === '*';
      const actionMatch = permission.actions.includes(action) || permission.actions.includes('*');
      return resourceMatch && actionMatch;
    });

    // Check roles if required
    const hasRole = !requiredRoles || requiredRoles.some(role => 
      user.attributes.roles.includes(role)
    );

    if (!hasPermission || !hasRole) {
      navigate('/access-denied', {
        replace: true,
        state: {
          requiredPermissions: [`${resource}:${action}`],
          requiredRoles,
          userPermissions: user.permissions,
          userRoles: user.attributes.roles
        }
      });
    }
  }, [isAuthenticated, user, navigate, resource, action, requiredRoles]);

  if (!isAuthenticated || !user) {
    return <div>Loading...</div>;
  }

  return <>{children}</>;
};

// Test application with comprehensive routing
const TestApp: React.FC<{ initialUser?: User | null }> = ({ initialUser = null }) => {
  return (
    <BrowserRouter>
      <AuthProvider initialUser={initialUser}>
        <RouteErrorBoundary>
          <Routes>
            {/* Public routes */}
            <Route 
              path="/login" 
              element={
                <PublicLayout title="Login">
                  <LoginPage />
                </PublicLayout>
              } 
            />
            
            <Route 
              path="/access-denied" 
              element={
                <PublicLayout title="Access Denied">
                  <AccessDeniedPage />
                </PublicLayout>
              } 
            />

            {/* Protected routes */}
            <Route 
              path="/" 
              element={
                <ProtectedLayout title="Dashboard">
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                </ProtectedLayout>
              } 
            />

            <Route 
              path="/workflows" 
              element={
                <ProtectedLayout title="Workflows">
                  <PermissionProtectedRoute resource="workflow" action="read">
                    <WorkflowListPage />
                  </PermissionProtectedRoute>
                </ProtectedLayout>
              } 
            />

            <Route 
              path="/workflows/:id" 
              element={
                <ProtectedLayout title="Execute Workflow">
                  <PermissionProtectedRoute resource="workflow" action="execute">
                    <WorkflowExecutionPage />
                  </PermissionProtectedRoute>
                </ProtectedLayout>
              } 
            />

            <Route 
              path="/admin" 
              element={
                <ProtectedLayout title="Admin">
                  <PermissionProtectedRoute 
                    resource="admin" 
                    action="access" 
                    requiredRoles={['admin']}
                  >
                    <AdminPage />
                  </PermissionProtectedRoute>
                </ProtectedLayout>
              } 
            />

            <Route 
              path="/reports" 
              element={
                <ProtectedLayout title="Reports">
                  <PermissionProtectedRoute 
                    resource="reports" 
                    action="read"
                    requiredRoles={['manager', 'admin']}
                  >
                    <ReportsPage />
                  </PermissionProtectedRoute>
                </ProtectedLayout>
              } 
            />
          </Routes>
        </RouteErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
};

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('react-router', () => ({
  ...jest.requireActual('react-router'),
  useNavigate: () => mockNavigate
}));

describe('Protected Route Behavior Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
    
    // Setup access control service mocks
    mockAccessControlService.checkAccess.mockImplementation((user, resource, action) => ({
      allowed: user.permissions.some(perm => 
        (perm.resource === resource || perm.resource === '*') &&
        (perm.actions.includes(action) || perm.actions.includes('*'))
      ),
      reason: 'Permission check'
    }));
  });

  describe('Unauthenticated User Scenarios', () => {
    it('should redirect unauthenticated users to login from protected routes', async () => {
      render(<TestApp />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
      });
    });

    it('should allow access to public routes without authentication', () => {
      window.history.pushState({}, 'Login', '/login');
      
      render(<TestApp />);

      expect(screen.getByText('Login Required')).toBeInTheDocument();
      expect(screen.getByTestId('login-options')).toBeInTheDocument();
    });

    it('should allow access to access denied page without authentication', () => {
      window.history.pushState({}, 'Access Denied', '/access-denied');
      
      render(<TestApp />);

      expect(screen.getByText('Access Denied')).toBeInTheDocument();
    });
  });

  describe('Admin User Scenarios', () => {
    it('should allow admin user to access all protected routes', async () => {
      render(<TestApp initialUser={adminUser} />);

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Welcome, Admin User')).toBeInTheDocument();
      });

      // Check permissions display
      const permissionsElement = screen.getByTestId('user-permissions');
      expect(permissionsElement).toHaveTextContent('*: *');
    });

    it('should allow admin to access workflow pages', async () => {
      window.history.pushState({}, 'Workflows', '/workflows');
      
      render(<TestApp initialUser={adminUser} />);

      await waitFor(() => {
        expect(screen.getByText('Workflows')).toBeInTheDocument();
        expect(screen.getByText('Available workflows for Admin User')).toBeInTheDocument();
      });
    });

    it('should allow admin to execute workflows', async () => {
      window.history.pushState({}, 'Execute', '/workflows/test-workflow');
      
      render(<TestApp initialUser={adminUser} />);

      await waitFor(() => {
        expect(screen.getByText('Execute Workflow: test-workflow')).toBeInTheDocument();
        expect(screen.getByTestId('workflow-execution')).toBeInTheDocument();
      });
    });

    it('should allow admin to access admin panel', async () => {
      window.history.pushState({}, 'Admin', '/admin');
      
      render(<TestApp initialUser={adminUser} />);

      await waitFor(() => {
        expect(screen.getByText('Admin Panel')).toBeInTheDocument();
        expect(screen.getByTestId('admin-controls')).toBeInTheDocument();
      });
    });

    it('should allow admin to access reports', async () => {
      window.history.pushState({}, 'Reports', '/reports');
      
      render(<TestApp initialUser={adminUser} />);

      await waitFor(() => {
        expect(screen.getByText('Reports')).toBeInTheDocument();
        expect(screen.getByTestId('reports-list')).toBeInTheDocument();
      });
    });
  });

  describe('Manager User Scenarios', () => {
    it('should allow manager to access dashboard and workflows', async () => {
      render(<TestApp initialUser={managerUser} />);

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Welcome, Manager User')).toBeInTheDocument();
      });
    });

    it('should allow manager to access reports', async () => {
      window.history.pushState({}, 'Reports', '/reports');
      
      render(<TestApp initialUser={managerUser} />);

      await waitFor(() => {
        expect(screen.getByText('Reports')).toBeInTheDocument();
        expect(screen.getByText('Reports for: Manager User')).toBeInTheDocument();
      });
    });

    it('should deny manager access to admin panel', async () => {
      window.history.pushState({}, 'Admin', '/admin');
      
      render(<TestApp initialUser={managerUser} />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/access-denied', expect.objectContaining({
          replace: true,
          state: expect.objectContaining({
            requiredPermissions: ['admin:access'],
            requiredRoles: ['admin']
          })
        }));
      });
    });
  });

  describe('Regular User Scenarios', () => {
    it('should allow regular user to access dashboard', async () => {
      render(<TestApp initialUser={regularUser} />);

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Welcome, Regular User')).toBeInTheDocument();
      });
    });

    it('should allow regular user to view workflows', async () => {
      window.history.pushState({}, 'Workflows', '/workflows');
      
      render(<TestApp initialUser={regularUser} />);

      await waitFor(() => {
        expect(screen.getByText('Workflows')).toBeInTheDocument();
        expect(screen.getByText('Available workflows for Regular User')).toBeInTheDocument();
      });
    });

    it('should allow regular user to execute workflows', async () => {
      window.history.pushState({}, 'Execute', '/workflows/test-workflow');
      
      render(<TestApp initialUser={regularUser} />);

      await waitFor(() => {
        expect(screen.getByText('Execute Workflow: test-workflow')).toBeInTheDocument();
      });
    });

    it('should deny regular user access to admin panel', async () => {
      window.history.pushState({}, 'Admin', '/admin');
      
      render(<TestApp initialUser={regularUser} />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/access-denied', expect.objectContaining({
          replace: true
        }));
      });
    });

    it('should deny regular user access to reports', async () => {
      window.history.pushState({}, 'Reports', '/reports');
      
      render(<TestApp initialUser={regularUser} />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/access-denied', expect.objectContaining({
          replace: true
        }));
      });
    });
  });

  describe('Restricted User Scenarios', () => {
    it('should allow restricted user to access dashboard', async () => {
      render(<TestApp initialUser={restrictedUser} />);

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Welcome, Restricted User')).toBeInTheDocument();
      });
    });

    it('should allow restricted user limited workflow access', async () => {
      window.history.pushState({}, 'Workflows', '/workflows');
      
      render(<TestApp initialUser={restrictedUser} />);

      await waitFor(() => {
        expect(screen.getByText('Workflows')).toBeInTheDocument();
      });
    });

    it('should deny restricted user workflow execution', async () => {
      window.history.pushState({}, 'Execute', '/workflows/test-workflow');
      
      render(<TestApp initialUser={restrictedUser} />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/access-denied', expect.objectContaining({
          replace: true
        }));
      });
    });
  });

  describe('Navigation Integration', () => {
    it('should show appropriate navigation items based on user permissions', async () => {
      render(<TestApp initialUser={adminUser} />);

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });

      // Admin should see all navigation items
      expect(screen.getByText('Dify Workflow Frontend')).toBeInTheDocument();
    });

    it('should handle navigation between protected routes', async () => {
      render(<TestApp initialUser={managerUser} />);

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });

      // Navigate to workflows
      fireEvent.click(screen.getByText('Execute Test Workflow'));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/workflows/test-workflow');
      });
    });
  });

  describe('Error Boundary Integration', () => {
    it('should catch route-level errors and display error boundary', () => {
      const ErrorComponent: React.FC = () => {
        throw new Error('Route component error');
      };

      const TestErrorApp: React.FC = () => (
        <BrowserRouter>
          <RouteErrorBoundary routeName="Error Route">
            <ErrorComponent />
          </RouteErrorBoundary>
        </BrowserRouter>
      );

      render(<TestErrorApp />);

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Route component error')).toBeInTheDocument();
    });

    it('should provide retry functionality in route error boundary', () => {
      let shouldThrow = true;
      
      const ConditionalErrorComponent: React.FC = () => {
        if (shouldThrow) {
          throw new Error('Conditional route error');
        }
        return <div>Route recovered</div>;
      };

      const TestErrorApp: React.FC = () => (
        <BrowserRouter>
          <RouteErrorBoundary routeName="Conditional Route">
            <ConditionalErrorComponent />
          </RouteErrorBoundary>
        </BrowserRouter>
      );

      const { rerender } = render(<TestErrorApp />);

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Fix the error
      shouldThrow = false;

      // Click retry
      fireEvent.click(screen.getByText('Try Again'));

      rerender(<TestErrorApp />);

      expect(screen.getByText('Route recovered')).toBeInTheDocument();
    });
  });

  describe('Dynamic Permission Updates', () => {
    it('should handle permission changes without re-authentication', async () => {
      const { rerender } = render(<TestApp initialUser={regularUser} />);

      // Initially should access dashboard
      await waitFor(() => {
        expect(screen.getByText('Welcome, Regular User')).toBeInTheDocument();
      });

      // Update user permissions to include admin access
      const updatedUser: User = {
        ...regularUser,
        permissions: [
          ...regularUser.permissions,
          {
            resource: 'admin',
            actions: ['access'],
            conditions: []
          }
        ],
        attributes: {
          ...regularUser.attributes,
          roles: ['user', 'admin']
        }
      };

      rerender(<TestApp initialUser={updatedUser} />);

      // Should now be able to access admin (if navigated there)
      window.history.pushState({}, 'Admin', '/admin');
      
      rerender(<TestApp initialUser={updatedUser} />);

      // The navigation should not be blocked now
      expect(mockNavigate).not.toHaveBeenCalledWith('/access-denied', expect.any(Object));
    });
  });

  describe('Session Expiry Scenarios', () => {
    it('should redirect to login when session expires during navigation', async () => {
      const { rerender } = render(<TestApp initialUser={regularUser} />);

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });

      // Simulate session expiry
      rerender(<TestApp initialUser={null} />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
      });
    });
  });
});