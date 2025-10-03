/**
 * Protected Route Integration Examples
 * 
 * This file demonstrates how to use the protected route system
 * with authentication hooks, permission checking, and error boundaries.
 */

import React from 'react';
import { 
  useAuthRequired, 
  usePermissionRequired, 
  usePermissionCheck,
  useMultiplePermissionCheck,
  useRoleRequired 
} from '../hooks/useProtectedRoute';
import { 
  ProtectedRoute, 
  PermissionProtectedRoute,
  MultiPermissionProtectedRoute,
  RoleProtectedRoute 
} from '../components/ProtectedRoute';
import { RouteErrorBoundary, withRouteErrorBoundary } from '../components/RouteErrorBoundary';

// Example 1: Basic Authentication Protection
export const BasicProtectedComponent: React.FC = () => {
  const { isLoading, isAuthenticated } = useAuthRequired();

  if (isLoading) {
    return <div>Checking authentication...</div>;
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  return (
    <div>
      <h1>Protected Dashboard</h1>
      <p>This content is only visible to authenticated users.</p>
    </div>
  );
};

// Example 2: Permission-Based Protection
export const WorkflowManagementComponent: React.FC = () => {
  const { isLoading, isAuthenticated, hasPermission, user } = usePermissionRequired({
    resource: 'workflow',
    action: 'manage'
  });

  if (isLoading || !isAuthenticated || !hasPermission) {
    return null; // Will redirect appropriately
  }

  return (
    <div>
      <h1>Workflow Management</h1>
      <p>Welcome {user.name}, you can manage workflows.</p>
    </div>
  );
};

// Example 3: Multiple Permission Check
export const AdminDashboard: React.FC = () => {
  const { isLoading, isAuthenticated } = useAuthRequired();
  
  // Check multiple permissions for conditional rendering
  const permissions = useMultiplePermissionCheck([
    { resource: 'user', action: 'manage' },
    { resource: 'system', action: 'configure' },
    { resource: 'audit', action: 'read' },
    { resource: 'workflow', action: 'delete' }
  ]);

  if (isLoading || !isAuthenticated) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Admin Dashboard</h1>
      
      {permissions['user:manage'] && (
        <section>
          <h2>User Management</h2>
          <p>Manage user accounts and permissions</p>
        </section>
      )}
      
      {permissions['system:configure'] && (
        <section>
          <h2>System Configuration</h2>
          <p>Configure system settings</p>
        </section>
      )}
      
      {permissions['audit:read'] && (
        <section>
          <h2>Audit Logs</h2>
          <p>View system audit logs</p>
        </section>
      )}
      
      {permissions['workflow:delete'] && (
        <section>
          <h2>Workflow Cleanup</h2>
          <p>Delete old workflows</p>
        </section>
      )}
      
      {!Object.values(permissions).some(Boolean) && (
        <p>You don&apos;t have access to any admin features.</p>
      )}
    </div>
  );
};

// Example 4: Role-Based Protection
export const SuperAdminPanel: React.FC = () => {
  const { isLoading, isAuthenticated, hasRequiredRole, user } = useRoleRequired([
    'admin', 
    'superadmin'
  ]);

  if (isLoading || !isAuthenticated || !hasRequiredRole) {
    return null; // Will redirect appropriately
  }

  return (
    <div>
      <h1>Super Admin Panel</h1>
      <p>Welcome {user.name}, you have super admin access.</p>
      <p>Your roles: {user.attributes.roles?.join(', ')}</p>
    </div>
  );
};

// Example 5: Conditional Permission Checking
export const WorkflowListComponent: React.FC = () => {
  const { isLoading, isAuthenticated } = useAuthRequired();
  
  // Check individual permissions for UI elements
  const canExecute = usePermissionCheck('workflow', 'execute');
  const canCreate = usePermissionCheck('workflow', 'create');
  const canDelete = usePermissionCheck('workflow', 'delete');
  const canManage = usePermissionCheck('workflow', 'manage');

  if (isLoading || !isAuthenticated) {
    return <div>Loading workflows...</div>;
  }

  return (
    <div>
      <h1>Available Workflows</h1>
      
      <div style={{ marginBottom: '1rem' }}>
        {canCreate && (
          <button>Create New Workflow</button>
        )}
        {canManage && (
          <button>Manage Workflows</button>
        )}
      </div>
      
      <div>
        {/* Mock workflow list */}
        {['Workflow 1', 'Workflow 2', 'Workflow 3'].map((workflow, index) => (
          <div key={index} style={{ 
            border: '1px solid #ddd', 
            padding: '1rem', 
            margin: '0.5rem 0' 
          }}>
            <h3>{workflow}</h3>
            <div>
              {canExecute && (
                <button>Execute</button>
              )}
              {canDelete && (
                <button style={{ marginLeft: '0.5rem', backgroundColor: '#ff6b6b' }}>
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Example 6: Using Higher-Order Components
export const SimpleProtectedPage: React.FC = () => (
  <div>
    <h1>Simple Protected Page</h1>
    <p>This page requires authentication.</p>
  </div>
);

export const PermissionProtectedPage: React.FC = () => (
  <div>
    <h1>Admin Only Page</h1>
    <p>This page requires admin permissions.</p>
  </div>
);

export const MultiPermissionPage: React.FC = () => (
  <div>
    <h1>Multi-Permission Page</h1>
    <p>This page requires either workflow management or user management permissions.</p>
  </div>
);

export const RoleProtectedPage: React.FC = () => (
  <div>
    <h1>Manager Page</h1>
    <p>This page is for managers and admins only.</p>
  </div>
);

// Example 7: Route Components with Error Boundaries

// Basic authentication protection
export const SimpleProtectedExample: React.FC = () => (
  <ProtectedRoute>
    <SimpleProtectedPage />
  </ProtectedRoute>
);

// Permission-based protection
export const AdminProtectedExample: React.FC = () => (
  <PermissionProtectedRoute resource="admin" action="access">
    <PermissionProtectedPage />
  </PermissionProtectedRoute>
);

// Multiple permission protection (user needs any of these)
export const MultiPermissionProtectedExample: React.FC = () => (
  <MultiPermissionProtectedRoute 
    permissions={[
      { resource: 'workflow', action: 'manage' },
      { resource: 'user', action: 'manage' }
    ]}
  >
    <MultiPermissionPage />
  </MultiPermissionProtectedRoute>
);

// Role-based protection
export const RoleProtectedExample: React.FC = () => (
  <RoleProtectedRoute roles={['manager', 'admin']}>
    <RoleProtectedPage />
  </RoleProtectedRoute>
);

// With error boundary
export const ProtectedWithErrorBoundaryExample: React.FC = () => (
  <RouteErrorBoundary routeName="Protected Dashboard">
    <ProtectedRoute>
      <BasicProtectedComponent />
    </ProtectedRoute>
  </RouteErrorBoundary>
);

// Using HOC for error boundary
export const ProtectedWithHOCExample = withRouteErrorBoundary(
  (): React.ReactElement => (
    <ProtectedRoute>
      <WorkflowManagementComponent />
    </ProtectedRoute>
  ),
  'Workflow Management'
);

// Grouped examples for easy access
export const ProtectedRouteExamples = {
  SimpleProtected: SimpleProtectedExample,
  AdminProtected: AdminProtectedExample,
  MultiPermissionProtected: MultiPermissionProtectedExample,
  RoleProtected: RoleProtectedExample,
  ProtectedWithErrorBoundary: ProtectedWithErrorBoundaryExample,
  ProtectedWithHOC: ProtectedWithHOCExample
};

// Example 8: Custom Loading Component
const CustomLoadingComponent: React.FC = () => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '200px',
    fontFamily: 'system-ui, sans-serif'
  }}>
    <div style={{
      width: '50px',
      height: '50px',
      border: '5px solid #f3f3f3',
      borderTop: '5px solid #0078d4',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }}></div>
    <p style={{ marginTop: '1rem', color: '#666' }}>
      Verifying your permissions...
    </p>
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

export const ProtectedWithCustomLoading: React.FC = () => (
  <PermissionProtectedRoute 
    resource="workflow" 
    action="execute"
    loadingComponent={CustomLoadingComponent}
  >
    <WorkflowManagementComponent />
  </PermissionProtectedRoute>
);

// Example 9: Error Handling in Async Operations
export const AsyncProtectedComponent: React.FC = () => {
  const { isLoading, isAuthenticated } = useAuthRequired();
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isAuthenticated) {
      // Simulate async operation
      const fetchData = async (): Promise<void> => {
        try {
          // Mock API call
          await new Promise(resolve => setTimeout(resolve, 1000));
          setData({ message: 'Data loaded successfully' });
        } catch (err) {
          setError('Failed to load data');
        }
      };

      fetchData();
    }
  }, [isAuthenticated]);

  if (isLoading || !isAuthenticated) {
    return null;
  }

  if (error) {
    return (
      <div style={{ color: 'red', padding: '1rem' }}>
        Error: {error}
      </div>
    );
  }

  if (!data) {
    return <div>Loading data...</div>;
  }

  return (
    <div>
      <h1>Async Protected Component</h1>
      <p>{data.message}</p>
    </div>
  );
};

export default {
  BasicProtectedComponent,
  WorkflowManagementComponent,
  AdminDashboard,
  SuperAdminPanel,
  WorkflowListComponent,
  ProtectedRouteExamples,
  ProtectedWithCustomLoading,
  AsyncProtectedComponent
};