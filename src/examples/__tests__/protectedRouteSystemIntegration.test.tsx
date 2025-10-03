/**
 * Comprehensive integration tests for the protected route system
 * Tests the complete flow from authentication to route protection
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router';
import { AuthProvider } from '../../context/AuthContext';
import { 
  ProtectedLayout, 
  PublicLayout, 
  DashboardLayout, 
  FullWidthLayout 
} from '../../components/Layout';
import { 
  ProtectedRoute, 
  PermissionProtectedRoute,
  MultiPermissionProtectedRoute,
  RoleProtectedRoute 
} from '../../components/ProtectedRoute';
import { RouteErrorBoundary } from '../../components/RouteErrorBoundary';
import { User, SessionData } from '../../types/auth';

// Mock user data
const mockAdminUser: User = {
  id: 'admin-user-id',
  email: 'admin@example.com',
  name: 'Admin User',
  provider: 'azure',
  attributes: {
    domain: 'example.com',
    roles: ['admin', 'user'],
    department: 'IT'
  },
  permissions: [
    {
      resource: 'workflow',
      actions: ['*'],
      conditions: []
    },
    {
      resource: 'admin',
      actions: ['access', 'manage'],
      conditions: []
    },
    {
      resource: '*',
      actions: ['read'],
      conditions: []
    }
  ]
};

const mockRegularUser: User = {
  id: 'regular-user-id',
  email: 'user@example.com',
  name: 'Regular User',
  provider: 'github',
  attributes: {
    domain: 'example.com',
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

// Mock session data
const mockAdminSession: SessionData = {
  accessToken: 'admin-access-token',
  refreshToken: 'admin-refresh-token',
  expiresAt: Date.now() + 3600000,
  user: mockAdminUser
};

const mockRegularSession: SessionData = {
  accessToken: 'user-access-token',
  refreshToken: 'user-refresh-token',
  expiresAt: Date.now() + 3600000,
  user: mockRegularUser
};

// Test components
const DashboardPage: React.FC = () => (
  <div>
    <h1>Dashboard</h1>
    <p>Welcome to the dashboard</p>
  </div>
);

const WorkflowsPage: React.FC = () => (
  <div>
    <h1>Workflows</h1>
    <p>Available workflows</p>
  </div>
);

const AdminPage: React.FC = () => (
  <div>
    <h1>Admin Panel</h1>
    <p>Admin only content</p>
  </div>
);

const WorkflowExecutionPage: React.FC = () => (
  <div>
    <h1>Execute Workflow</h1>
    <p>Workflow execution interface</p>
  </div>
);

const LoginPage: React.FC = () => (
  <div>
    <h1>Login</h1>
    <p>Please log in</p>
  </div>
);

const AccessDeniedPage: React.FC = () => (
  <div>
    <h1>Access Denied</h1>
    <p>You don't have permission</p>
  </div>
);

// Test application with protected routes
const TestApp: React.FC<{ initialUser?: User | null }> = ({ initialUser = null }) => {
  return (
    <BrowserRouter>
      <AuthProvider>
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
              <DashboardLayout title="Dashboard">
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              </DashboardLayout>
            } 
          />

          <Route 
            path="/workflows" 
            element={
              <ProtectedLayout title="Workflows">
                <PermissionProtectedRoute resource="workflow" action="read">
                  <WorkflowsPage />
                </PermissionProtectedRoute>
              </ProtectedLayout>
            } 
          />

          <Route 
            path="/workflows/:id" 
            element={
              <FullWidthLayout title="Execute Workflow">
                <PermissionProtectedRoute resource="workflow" action="execute">
                  <WorkflowExecutionPage />
                </PermissionProtectedRoute>
              </FullWidthLayout>
            } 
          />

          <Route 
            path="/admin" 
            element={
              <ProtectedLayout title="Admin">
                <MultiPermissionProtectedRoute 
                  permissions={[
                    { resource: 'admin', action: 'access' },
                    { resource: 'admin', action: 'manage' }
                  ]}
                >
                  <AdminPage />
                </MultiPermissionProtectedRoute>
              </ProtectedLayout>
            } 
          />

          <Route 
            path="/manager" 
            element={
              <ProtectedLayout title="Manager">
                <RoleProtectedRoute roles={['manager', 'admin']}>
                  <div>
                    <h1>Manager Panel</h1>
                    <p>Manager content</p>
                  </div>
                </RoleProtectedRoute>
              </ProtectedLayout>
            } 
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

// Mock navigation functions
const mockNavigate = jest.fn();
jest.mock('react-router', () => ({
  ...jest.requireActual('react-router'),
  useNavigate: () => mockNavigate
}));

// Mock token manager and services
jest.mock('../../services/tokenManager', () => ({
  TokenManager: {
    storeSession: jest.fn(),
    getStoredSession: jest.fn(() => null),
    isTokenValid: jest.fn(() => false),
    needsRefresh: jest.fn(() => false),
    clearSession: jest.fn(),
    getValidAccessToken: jest.fn(() => null),
    detectSuspiciousActivity: jest.fn(() => false)
  }
}));

jest.mock('../../services/tokenRefresh', () => ({
  TokenRefreshService: {
    refreshAccessToken: jest.fn(() => Promise.resolve(null)),
    setupAutoRefresh: jest.fn(),
    clearAutoRefresh: jest.fn(),
    validateAndRefreshSession: jest.fn(() => Promise.resolve({ isValid: false, user: null }))
  }
}));

jest.mock('../../utils/oauth-redirect', () => ({
  initiateOAuthLogin: jest.fn(() => Promise.resolve())
}));

describe('Protected Route System Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
  });

  describe('Unauthenticated User Flow', () => {
    it('should redirect unauthenticated users to login from protected routes', async () => {
      render(<TestApp />);

      // Should show authentication required message
      await waitFor(() => {
        expect(screen.getByText('Authentication Required')).toBeInTheDocument();
      });
    });

    it('should allow access to public routes', () => {
      window.history.pushState({}, 'Login', '/login');
      
      render(<TestApp />);

      expect(screen.getByText('Please log in')).toBeInTheDocument();
      expect(screen.queryByText('Dify Workflow Frontend')).not.toBeInTheDocument();
    });
  });

  describe('Admin User Flow', () => {
    beforeEach(() => {
      // Mock successful authentication
      const mockTokenManager = require('../../services/tokenManager').TokenManager;
      const mockTokenRefresh = require('../../services/tokenRefresh').TokenRefreshService;
      
      mockTokenManager.getStoredSession.mockReturnValue(mockAdminSession);
      mockTokenManager.isTokenValid.mockReturnValue(true);
      mockTokenRefresh.validateAndRefreshSession.mockResolvedValue({
        isValid: true,
        user: mockAdminUser
      });
    });

    it('should allow admin user to access all protected routes', async () => {
      render(<TestApp />);

      // Should show dashboard
      await waitFor(() => {
        expect(screen.getByText('Welcome to the dashboard')).toBeInTheDocument();
        expect(screen.getByText('Admin User')).toBeInTheDocument();
      });

      // Should show navigation
      expect(screen.getByText('Dify Workflow Frontend')).toBeInTheDocument();
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });

    it('should allow admin to access workflow pages', async () => {
      window.history.pushState({}, 'Workflows', '/workflows');
      
      render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByText('Available workflows')).toBeInTheDocument();
        expect(screen.getByText('Admin User')).toBeInTheDocument();
      });
    });

    it('should allow admin to access admin panel', async () => {
      window.history.pushState({}, 'Admin', '/admin');
      
      render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByText('Admin Panel')).toBeInTheDocument();
        expect(screen.getByText('Admin only content')).toBeInTheDocument();
      });
    });

    it('should allow admin to access manager panel (role-based)', async () => {
      window.history.pushState({}, 'Manager', '/manager');
      
      render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByText('Manager Panel')).toBeInTheDocument();
        expect(screen.getByText('Manager content')).toBeInTheDocument();
      });
    });
  });

  describe('Regular User Flow', () => {
    beforeEach(() => {
      // Mock successful authentication for regular user
      const mockTokenManager = require('../../services/tokenManager').TokenManager;
      const mockTokenRefresh = require('../../services/tokenRefresh').TokenRefreshService;
      
      mockTokenManager.getStoredSession.mockReturnValue(mockRegularSession);
      mockTokenManager.isTokenValid.mockReturnValue(true);
      mockTokenRefresh.validateAndRefreshSession.mockResolvedValue({
        isValid: true,
        user: mockRegularUser
      });
    });

    it('should allow regular user to access dashboard', async () => {
      render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Regular User')).toBeInTheDocument();
      });
    });

    it('should allow regular user to access workflows (has read permission)', async () => {
      window.history.pushState({}, 'Workflows', '/workflows');
      
      render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByText('Available workflows')).toBeInTheDocument();
        expect(screen.getByText('Regular User')).toBeInTheDocument();
      });
    });

    it('should allow regular user to execute workflows (has execute permission)', async () => {
      window.history.pushState({}, 'Execute', '/workflows/test-workflow');
      
      render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByText('Workflow execution interface')).toBeInTheDocument();
        expect(screen.getByText('Regular User')).toBeInTheDocument();
      });
    });

    it('should deny regular user access to admin panel', async () => {
      window.history.pushState({}, 'Admin', '/admin');
      
      render(<TestApp />);

      // Should redirect to access denied
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/access-denied', expect.any(Object));
      });
    });

    it('should deny regular user access to manager panel (lacks role)', async () => {
      window.history.pushState({}, 'Manager', '/manager');
      
      render(<TestApp />);

      // Should redirect to access denied
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/access-denied', expect.any(Object));
      });
    });
  });

  describe('Error Boundary Integration', () => {
    it('should catch and handle route-level errors', () => {
      const ErrorComponent: React.FC = () => {
        throw new Error('Test route error');
      };

      const TestErrorApp: React.FC = () => (
        <BrowserRouter>
          <RouteErrorBoundary routeName="Test Route">
            <ErrorComponent />
          </RouteErrorBoundary>
        </BrowserRouter>
      );

      render(<TestErrorApp />);

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Test route error')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('should provide retry functionality in error boundary', () => {
      let shouldThrow = true;
      
      const ConditionalErrorComponent: React.FC = () => {
        if (shouldThrow) {
          throw new Error('Conditional error');
        }
        return <div>Component recovered</div>;
      };

      const TestErrorApp: React.FC = () => (
        <BrowserRouter>
          <RouteErrorBoundary routeName="Conditional Error">
            <ConditionalErrorComponent />
          </RouteErrorBoundary>
        </BrowserRouter>
      );

      const { rerender } = render(<TestErrorApp />);

      // Should show error initially
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Fix the error condition
      shouldThrow = false;

      // Click retry
      fireEvent.click(screen.getByText('Try Again'));

      // Re-render to simulate retry
      rerender(<TestErrorApp />);

      // Should show recovered component
      expect(screen.getByText('Component recovered')).toBeInTheDocument();
    });
  });

  describe('Layout Integration', () => {
    beforeEach(() => {
      // Mock successful authentication
      const mockTokenManager = require('../../services/tokenManager').TokenManager;
      const mockTokenRefresh = require('../../services/tokenRefresh').TokenRefreshService;
      
      mockTokenManager.getStoredSession.mockReturnValue(mockAdminSession);
      mockTokenManager.isTokenValid.mockReturnValue(true);
      mockTokenRefresh.validateAndRefreshSession.mockResolvedValue({
        isValid: true,
        user: mockAdminUser
      });
    });

    it('should render navigation in protected layouts', async () => {
      render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByText('Dify Workflow Frontend')).toBeInTheDocument();
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Workflows')).toBeInTheDocument();
      });
    });

    it('should not render navigation in public layouts', () => {
      window.history.pushState({}, 'Login', '/login');
      
      render(<TestApp />);

      expect(screen.getByText('Please log in')).toBeInTheDocument();
      expect(screen.queryByText('Dify Workflow Frontend')).not.toBeInTheDocument();
    });

    it('should handle logout from navigation', async () => {
      render(<TestApp />);

      await waitFor(() => {
        expect(screen.getByText('Admin User')).toBeInTheDocument();
      });

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      fireEvent.click(logoutButton);

      // Should call logout function
      // Note: The actual logout behavior would be tested in the AuthContext tests
      expect(logoutButton).toBeInTheDocument();
    });
  });

  describe('Mobile Navigation', () => {
    beforeEach(() => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      // Mock successful authentication
      const mockTokenManager = require('../../services/tokenManager').TokenManager;
      const mockTokenRefresh = require('../../services/tokenRefresh').TokenRefreshService;
      
      mockTokenManager.getStoredSession.mockReturnValue(mockAdminSession);
      mockTokenManager.isTokenValid.mockReturnValue(true);
      mockTokenRefresh.validateAndRefreshSession.mockResolvedValue({
        isValid: true,
        user: mockAdminUser
      });
    });

    it('should show mobile navigation toggle on small screens', async () => {
      const { rerender } = render(<TestApp />);

      // Force re-render to trigger mobile detection
      rerender(<TestApp />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Toggle navigation' })).toBeInTheDocument();
      });
    });
  });
});