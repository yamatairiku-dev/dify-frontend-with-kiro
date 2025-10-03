import React from 'react';
import { useAuthRequired, usePermissionRequired, useAnyPermissionRequired, useRoleRequired } from '../hooks/useProtectedRoute';

/**
 * Loading component displayed while checking authentication/permissions
 */
const LoadingComponent: React.FC = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '200px',
    fontFamily: 'system-ui, sans-serif'
  }}>
    <div style={{
      width: '40px',
      height: '40px',
      border: '4px solid #f3f3f3',
      borderTop: '4px solid #0078d4',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
      marginRight: '1rem'
    }}></div>
    <span>Checking permissions...</span>
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

/**
 * Props for ProtectedRoute component
 */
interface ProtectedRouteProps {
  children: React.ReactNode;
  loadingComponent?: React.ComponentType;
}

/**
 * Basic protected route that only requires authentication
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  loadingComponent: LoadingComp = LoadingComponent 
}) => {
  const { isLoading, isAuthenticated } = useAuthRequired();

  if (isLoading) {
    return <LoadingComp />;
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  return <>{children}</>;
};

/**
 * Props for PermissionProtectedRoute component
 */
interface PermissionProtectedRouteProps extends ProtectedRouteProps {
  resource: string;
  action: string;
  redirectTo?: string;
  allowWildcard?: boolean;
}

/**
 * Protected route that requires specific permissions
 */
export const PermissionProtectedRoute: React.FC<PermissionProtectedRouteProps> = ({ 
  children, 
  resource,
  action,
  redirectTo,
  allowWildcard,
  loadingComponent: LoadingComp = LoadingComponent 
}) => {
  const { isLoading, isAuthenticated, hasPermission } = usePermissionRequired({
    resource,
    action,
    redirectTo,
    allowWildcard
  });

  if (isLoading) {
    return <LoadingComp />;
  }

  if (!isAuthenticated || !hasPermission) {
    return null; // Will redirect appropriately
  }

  return <>{children}</>;
};

/**
 * Props for MultiPermissionProtectedRoute component
 */
interface MultiPermissionProtectedRouteProps extends ProtectedRouteProps {
  permissions: Array<{
    resource: string;
    action: string;
    allowWildcard?: boolean;
  }>;
  redirectTo?: string;
}

/**
 * Protected route that requires any of multiple permissions
 */
export const MultiPermissionProtectedRoute: React.FC<MultiPermissionProtectedRouteProps> = ({ 
  children, 
  permissions,
  redirectTo,
  loadingComponent: LoadingComp = LoadingComponent 
}) => {
  const { isLoading, isAuthenticated, hasAnyPermission } = useAnyPermissionRequired(
    permissions,
    redirectTo
  );

  if (isLoading) {
    return <LoadingComp />;
  }

  if (!isAuthenticated || !hasAnyPermission) {
    return null; // Will redirect appropriately
  }

  return <>{children}</>;
};

/**
 * Props for RoleProtectedRoute component
 */
interface RoleProtectedRouteProps extends ProtectedRouteProps {
  roles: string[];
  redirectTo?: string;
}

/**
 * Protected route that requires specific roles
 */
export const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = ({ 
  children, 
  roles,
  redirectTo,
  loadingComponent: LoadingComp = LoadingComponent 
}) => {
  const { isLoading, isAuthenticated, hasRequiredRole } = useRoleRequired(roles, redirectTo);

  if (isLoading) {
    return <LoadingComp />;
  }

  if (!isAuthenticated || !hasRequiredRole) {
    return null; // Will redirect appropriately
  }

  return <>{children}</>;
};