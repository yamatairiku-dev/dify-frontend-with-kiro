import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import {
  BasicProtectedComponent,
  WorkflowManagementComponent,
  AdminDashboard,
  SuperAdminPanel,
  WorkflowListComponent,
  ProtectedRouteExamples,
  AsyncProtectedComponent
} from '../protectedRouteIntegration';
import { User } from '../../types/auth';

// Mock the auth context
const mockUser: User = {
  id: 'test-user-id',
  email: 'admin@example.com',
  name: 'Admin User',
  provider: 'azure',
  attributes: {
    domain: 'example.com',
    roles: ['admin', 'manager'],
    department: 'Engineering'
  },
  permissions: [
    {
      resource: 'workflow',
      actions: ['execute', 'manage', 'create', 'delete'],
      conditions: []
    },
    {
      resource: 'user',
      actions: ['manage'],
      conditions: []
    },
    {
      resource: 'system',
      actions: ['configure'],
      conditions: []
    },
    {
      resource: 'audit',
      actions: ['read'],
      conditions: []
    },
    {
      resource: 'admin',
      actions: ['access'],
      conditions: []
    }
  ]
};

const mockLimitedUser: User = {
  id: 'limited-user-id',
  email: 'user@example.com',
  name: 'Regular User',
  provider: 'google',
  attributes: {
    domain: 'example.com',
    roles: ['user'],
    department: 'Marketing'
  },
  permissions: [
    {
      resource: 'workflow',
      actions: ['execute'],
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

const mockLimitedAuthContext = {
  user: mockLimitedUser,
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
    {children}
  </BrowserRouter>
);

describe('Protected Route Integration Examples', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
  });

  describe('BasicProtectedComponent', () => {
    it('should render content for authenticated users', () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <BasicProtectedComponent />
        </TestWrapper>
      );
      
      expect(screen.getByText('Protected Dashboard')).toBeInTheDocument();
      expect(screen.getByText('This content is only visible to authenticated users.')).toBeInTheDocument();
    });

    it('should redirect unauthenticated users', async () => {
      mockUseAuth.mockReturnValue(mockUnauthenticatedContext);
      
      render(
        <TestWrapper>
          <BasicProtectedComponent />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
      });
    });
  });

  describe('WorkflowManagementComponent', () => {
    it('should render for users with workflow management permissions', () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <WorkflowManagementComponent />
        </TestWrapper>
      );
      
      expect(screen.getByText('Workflow Management')).toBeInTheDocument();
      expect(screen.getByText('Welcome Admin User, you can manage workflows.')).toBeInTheDocument();
    });

    it('should redirect users without workflow management permissions', async () => {
      mockUseAuth.mockReturnValue(mockLimitedAuthContext);
      
      render(
        <TestWrapper>
          <WorkflowManagementComponent />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/access-denied', expect.any(Object));
      });
    });
  });

  describe('AdminDashboard', () => {
    it('should show all admin sections for admin users', () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );
      
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      expect(screen.getByText('User Management')).toBeInTheDocument();
      expect(screen.getByText('System Configuration')).toBeInTheDocument();
      expect(screen.getByText('Audit Logs')).toBeInTheDocument();
      expect(screen.getByText('Workflow Cleanup')).toBeInTheDocument();
    });

    it('should show limited sections for limited users', () => {
      mockUseAuth.mockReturnValue(mockLimitedAuthContext);
      
      render(
        <TestWrapper>
          <AdminDashboard />
        </TestWrapper>
      );
      
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      expect(screen.queryByText('User Management')).not.toBeInTheDocument();
      expect(screen.queryByText('System Configuration')).not.toBeInTheDocument();
      expect(screen.queryByText('Audit Logs')).not.toBeInTheDocument();
      expect(screen.queryByText('Workflow Cleanup')).not.toBeInTheDocument();
      expect(screen.getByText("You don't have access to any admin features.")).toBeInTheDocument();
    });
  });

  describe('SuperAdminPanel', () => {
    it('should render for users with admin roles', () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <SuperAdminPanel />
        </TestWrapper>
      );
      
      expect(screen.getByText('Super Admin Panel')).toBeInTheDocument();
      expect(screen.getByText('Welcome Admin User, you have super admin access.')).toBeInTheDocument();
      expect(screen.getByText('Your roles: admin, manager')).toBeInTheDocument();
    });

    it('should redirect users without admin roles', async () => {
      mockUseAuth.mockReturnValue(mockLimitedAuthContext);
      
      render(
        <TestWrapper>
          <SuperAdminPanel />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/access-denied', expect.any(Object));
      });
    });
  });

  describe('WorkflowListComponent', () => {
    it('should show all workflow actions for admin users', () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <WorkflowListComponent />
        </TestWrapper>
      );
      
      expect(screen.getByText('Available Workflows')).toBeInTheDocument();
      expect(screen.getByText('Create New Workflow')).toBeInTheDocument();
      expect(screen.getByText('Manage Workflows')).toBeInTheDocument();
      
      // Should show execute and delete buttons for each workflow
      const executeButtons = screen.getAllByText('Execute');
      const deleteButtons = screen.getAllByText('Delete');
      expect(executeButtons).toHaveLength(3); // 3 workflows
      expect(deleteButtons).toHaveLength(3); // 3 workflows
    });

    it('should show limited actions for limited users', () => {
      mockUseAuth.mockReturnValue(mockLimitedAuthContext);
      
      render(
        <TestWrapper>
          <WorkflowListComponent />
        </TestWrapper>
      );
      
      expect(screen.getByText('Available Workflows')).toBeInTheDocument();
      expect(screen.queryByText('Create New Workflow')).not.toBeInTheDocument();
      expect(screen.queryByText('Manage Workflows')).not.toBeInTheDocument();
      
      // Should only show execute buttons
      const executeButtons = screen.getAllByText('Execute');
      expect(executeButtons).toHaveLength(3); // 3 workflows
      expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    });
  });

  describe('ProtectedRouteExamples', () => {
    it('should render SimpleProtected for authenticated users', () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      const SimpleProtected = ProtectedRouteExamples.SimpleProtected;
      
      render(
        <TestWrapper>
          <SimpleProtected />
        </TestWrapper>
      );
      
      expect(screen.getByText('Simple Protected Page')).toBeInTheDocument();
    });

    it('should render AdminProtected for users with admin access', () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      const AdminProtected = ProtectedRouteExamples.AdminProtected;
      
      render(
        <TestWrapper>
          <AdminProtected />
        </TestWrapper>
      );
      
      expect(screen.getByText('Admin Only Page')).toBeInTheDocument();
    });

    it('should render MultiPermissionProtected for users with workflow or user management', () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      const MultiPermissionProtected = ProtectedRouteExamples.MultiPermissionProtected;
      
      render(
        <TestWrapper>
          <MultiPermissionProtected />
        </TestWrapper>
      );
      
      expect(screen.getByText('Multi-Permission Page')).toBeInTheDocument();
    });

    it('should render RoleProtected for users with manager or admin roles', () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      const RoleProtected = ProtectedRouteExamples.RoleProtected;
      
      render(
        <TestWrapper>
          <RoleProtected />
        </TestWrapper>
      );
      
      expect(screen.getByText('Manager Page')).toBeInTheDocument();
    });

    it('should render ProtectedWithErrorBoundary', () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      const ProtectedWithErrorBoundary = ProtectedRouteExamples.ProtectedWithErrorBoundary;
      
      render(
        <TestWrapper>
          <ProtectedWithErrorBoundary />
        </TestWrapper>
      );
      
      expect(screen.getByText('Protected Dashboard')).toBeInTheDocument();
    });
  });

  describe('AsyncProtectedComponent', () => {
    it('should handle async data loading', async () => {
      mockUseAuth.mockReturnValue(mockAuthContext);
      
      render(
        <TestWrapper>
          <AsyncProtectedComponent />
        </TestWrapper>
      );
      
      // Should show loading initially
      expect(screen.getByText('Loading data...')).toBeInTheDocument();
      
      // Should show data after loading
      await waitFor(() => {
        expect(screen.getByText('Async Protected Component')).toBeInTheDocument();
        expect(screen.getByText('Data loaded successfully')).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should redirect unauthenticated users', async () => {
      mockUseAuth.mockReturnValue(mockUnauthenticatedContext);
      
      render(
        <TestWrapper>
          <AsyncProtectedComponent />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
      });
    });
  });
});