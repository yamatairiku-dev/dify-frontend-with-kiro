import { redirect } from 'react-router';
import { TokenRefreshService } from '../../src/services/tokenRefresh';
import type { User } from '../../src/types/auth';

/**
 * Authentication loader utility for protected routes
 * Checks if user is authenticated and redirects to login if not
 */
export async function requireAuth(): Promise<User> {
  try {
    // Validate existing session and refresh if needed
    const { isValid, user } = await TokenRefreshService.validateAndRefreshSession();
    
    if (isValid && user) {
      return user;
    }
    
    // No valid session, redirect to login
    throw redirect('/login');
  } catch (error) {
    // If error is already a redirect, re-throw it
    if (error instanceof Response) {
      throw error;
    }
    
    // For other errors, redirect to login
    console.error('Authentication check failed:', error);
    throw redirect('/login');
  }
}

/**
 * Check if user is already authenticated for public routes
 * Redirects to dashboard if already logged in
 */
export async function redirectIfAuthenticated(): Promise<null> {
  try {
    const { isValid } = await TokenRefreshService.validateAndRefreshSession();
    
    if (isValid) {
      // User is already authenticated, redirect to dashboard
      throw redirect('/');
    }
    
    return null;
  } catch (error) {
    // If error is already a redirect, re-throw it
    if (error instanceof Response) {
      throw error;
    }
    
    // For other errors, allow access to public route
    console.error('Authentication check failed:', error);
    return null;
  }
}

/**
 * Permission-based loader utility
 * Checks if user has required permissions for a resource
 */
export async function requirePermission(resource: string, action: string): Promise<User> {
  const user = await requireAuth();
  
  // Check if user has the required permission
  const hasPermission = user.permissions.some(permission => {
    // Check if permission matches resource (exact match or wildcard)
    const resourceMatch = permission.resource === resource || permission.resource === '*';
    
    // Check if permission includes the required action (exact match or wildcard)
    const actionMatch = permission.actions.includes(action) || permission.actions.includes('*');
    
    return resourceMatch && actionMatch;
  });
  
  if (!hasPermission) {
    throw redirect('/access-denied');
  }
  
  return user;
}

/**
 * Get current user without redirecting
 * Returns null if not authenticated
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const { isValid, user } = await TokenRefreshService.validateAndRefreshSession();
    return isValid ? user : null;
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
}