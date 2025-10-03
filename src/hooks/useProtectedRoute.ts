import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Permission } from '../types/auth';

/**
 * Hook for protecting routes that require authentication
 * Redirects to login if user is not authenticated
 */
export const useAuthRequired = (): { isLoading: boolean; isAuthenticated: boolean } => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  return { isLoading, isAuthenticated };
};

/**
 * Permission check options for route protection
 */
interface PermissionCheckOptions {
  resource: string;
  action: string;
  redirectTo?: string;
  allowWildcard?: boolean;
}

/**
 * Hook for protecting routes that require specific permissions
 * Redirects to access-denied if user lacks required permissions
 */
export const usePermissionRequired = (
  options: PermissionCheckOptions
): { 
  isLoading: boolean; 
  isAuthenticated: boolean; 
  hasPermission: boolean;
  user: any;
} => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const { resource, action, redirectTo = '/access-denied', allowWildcard = true } = options;

  // Check if user has the required permission
  const hasPermission = user ? checkUserPermission(user.permissions, resource, action, allowWildcard) : false;

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        navigate('/login', { replace: true });
        return;
      }

      if (user && !hasPermission) {
        navigate(redirectTo, { 
          replace: true,
          state: { 
            requiredResource: resource,
            requiredAction: action,
            userPermissions: user.permissions 
          }
        });
      }
    }
  }, [isAuthenticated, isLoading, user, hasPermission, navigate, redirectTo, resource, action]);

  return { 
    isLoading, 
    isAuthenticated, 
    hasPermission,
    user 
  };
};

/**
 * Hook for protecting routes with multiple permission requirements
 * User must have at least one of the specified permissions
 */
export const useAnyPermissionRequired = (
  permissionOptions: PermissionCheckOptions[],
  redirectTo: string = '/access-denied'
): {
  isLoading: boolean;
  isAuthenticated: boolean;
  hasAnyPermission: boolean;
  user: any;
} => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  // Check if user has any of the required permissions
  const hasAnyPermission = user ? 
    permissionOptions.some(option => 
      checkUserPermission(user.permissions, option.resource, option.action, option.allowWildcard ?? true)
    ) : false;

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        navigate('/login', { replace: true });
        return;
      }

      if (user && !hasAnyPermission) {
        navigate(redirectTo, { 
          replace: true,
          state: { 
            requiredPermissions: permissionOptions,
            userPermissions: user.permissions 
          }
        });
      }
    }
  }, [isAuthenticated, isLoading, user, hasAnyPermission, navigate, redirectTo, permissionOptions]);

  return { 
    isLoading, 
    isAuthenticated, 
    hasAnyPermission,
    user 
  };
};

/**
 * Hook for checking permissions without redirecting
 * Useful for conditional rendering of UI elements
 */
export const usePermissionCheck = (
  resource: string, 
  action: string, 
  allowWildcard: boolean = true
): boolean => {
  const { user } = useAuth();
  
  if (!user) return false;
  
  return checkUserPermission(user.permissions, resource, action, allowWildcard);
};

/**
 * Hook for checking multiple permissions without redirecting
 * Returns an object with permission check results
 */
export const useMultiplePermissionCheck = (
  permissions: Array<{ resource: string; action: string; allowWildcard?: boolean }>
): Record<string, boolean> => {
  const { user } = useAuth();
  
  if (!user) {
    return permissions.reduce((acc, perm) => {
      acc[`${perm.resource}:${perm.action}`] = false;
      return acc;
    }, {} as Record<string, boolean>);
  }

  return permissions.reduce((acc, perm) => {
    acc[`${perm.resource}:${perm.action}`] = checkUserPermission(
      user.permissions, 
      perm.resource, 
      perm.action, 
      perm.allowWildcard ?? true
    );
    return acc;
  }, {} as Record<string, boolean>);
};

/**
 * Utility function to check if user has a specific permission
 */
function checkUserPermission(
  userPermissions: Permission[], 
  requiredResource: string, 
  requiredAction: string,
  allowWildcard: boolean = true
): boolean {
  return userPermissions.some(permission => {
    // Check resource match (exact match or wildcard)
    const resourceMatch = permission.resource === requiredResource || 
      (allowWildcard && permission.resource === '*');
    
    // Check action match (exact match or wildcard)
    const actionMatch = permission.actions.includes(requiredAction) || 
      (allowWildcard && permission.actions.includes('*'));
    
    return resourceMatch && actionMatch;
  });
}

/**
 * Hook for role-based access control
 * Checks if user has any of the specified roles
 */
export const useRoleRequired = (
  requiredRoles: string[],
  redirectTo: string = '/access-denied'
): {
  isLoading: boolean;
  isAuthenticated: boolean;
  hasRequiredRole: boolean;
  user: any;
} => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  // Check if user has any of the required roles
  const hasRequiredRole = user ? 
    requiredRoles.some(role => user.attributes.roles?.includes(role)) : false;

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        navigate('/login', { replace: true });
        return;
      }

      if (user && !hasRequiredRole) {
        navigate(redirectTo, { 
          replace: true,
          state: { 
            requiredRoles,
            userRoles: user.attributes.roles || []
          }
        });
      }
    }
  }, [isAuthenticated, isLoading, user, hasRequiredRole, navigate, redirectTo, requiredRoles]);

  return { 
    isLoading, 
    isAuthenticated, 
    hasRequiredRole,
    user 
  };
};