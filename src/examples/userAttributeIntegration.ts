/**
 * Example integration of UserAttributeService with OAuth authentication flow
 * This demonstrates how to use the service in a real authentication scenario
 */

import { userAttributeService, RawUserData } from '../services/userAttributeService';
import { AuthProviderType, User } from '../types/auth';

/**
 * Example: Processing OAuth callback and extracting user attributes
 */
export async function processOAuthCallback(
  provider: AuthProviderType,
  authorizationCode: string
): Promise<User> {
  // Step 1: Exchange authorization code for access token (this would be done by OAuth service)
  const accessToken = await exchangeCodeForToken(authorizationCode, provider);
  
  // Step 2: Fetch user profile from provider API
  const rawUserData = await fetchUserProfile(accessToken, provider);
  
  // Step 3: Extract and normalize user attributes
  const user = userAttributeService.extractUserAttributes(rawUserData, provider);
  
  console.log('User attributes extracted:', {
    id: user.id,
    email: user.email,
    domain: user.attributes.domain,
    roles: user.attributes.roles,
    organization: user.attributes.organization,
  });
  
  return user;
}

/**
 * Example: Updating user profile with new information
 */
export function updateUserProfile(
  currentUser: User,
  newProfileData: RawUserData
): User {
  try {
    const updatedUser = userAttributeService.updateUserAttributes(
      currentUser,
      newProfileData
    );
    
    console.log('User profile updated:', {
      oldDomain: currentUser.attributes.domain,
      newDomain: updatedUser.attributes.domain,
      oldRoles: currentUser.attributes.roles,
      newRoles: updatedUser.attributes.roles,
    });
    
    return updatedUser;
  } catch (error) {
    console.error('Failed to update user profile:', error);
    throw error;
  }
}

/**
 * Mock function - would be implemented by OAuth service
 */
async function exchangeCodeForToken(
  code: string,
  provider: AuthProviderType
): Promise<string> {
  // This would make actual API calls to exchange the code for tokens
  return `mock-access-token-${provider}-${code}`;
}

/**
 * Mock function - would fetch actual user data from provider APIs
 */
async function fetchUserProfile(
  accessToken: string,
  provider: AuthProviderType
): Promise<RawUserData> {
  // Mock data for different providers
  switch (provider) {
    case 'azure':
      return {
        id: 'azure-123',
        email: 'john.doe@company.com',
        name: 'John Doe',
        userPrincipalName: 'john.doe@company.com',
        displayName: 'John Doe',
        jobTitle: 'Senior Developer',
        department: 'Engineering',
        companyName: 'Tech Corp',
      };
      
    case 'github':
      return {
        id: '456789',
        email: 'developer@github.com',
        name: 'GitHub Developer',
        login: 'dev-user',
        company: 'Open Source Inc',
        public_repos: 25,
        followers: 100,
        following: 50,
      };
      
    case 'google':
      return {
        id: 'google-789',
        email: 'user@gmail.com',
        name: 'Google User',
        sub: 'google-789',
        given_name: 'Google',
        family_name: 'User',
        hd: 'company.com',
      };
      
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Example: Attribute-based access control check
 */
export function checkUserAccess(user: User, requiredDomain?: string): boolean {
  // Example access control logic based on user attributes
  
  // Check domain requirement
  if (requiredDomain && user.attributes.domain !== requiredDomain) {
    console.log(`Access denied: User domain ${user.attributes.domain} does not match required ${requiredDomain}`);
    return false;
  }
  
  // Check for admin role
  if (user.attributes.roles.includes('admin')) {
    console.log('Access granted: User has admin role');
    return true;
  }
  
  // Check for developer role
  if (user.attributes.roles.includes('developer') || user.attributes.roles.includes('senior developer')) {
    console.log('Access granted: User has developer role');
    return true;
  }
  
  console.log('Access denied: User does not have required roles');
  return false;
}

/**
 * Example usage scenarios
 */
export const examples = {
  // Process Azure AD login
  async azureLogin() {
    const user = await processOAuthCallback('azure', 'auth-code-123');
    return checkUserAccess(user, 'company.com');
  },
  
  // Process GitHub login
  async githubLogin() {
    const user = await processOAuthCallback('github', 'auth-code-456');
    return checkUserAccess(user);
  },
  
  // Update user profile
  async profileUpdate() {
    const currentUser: User = {
      id: 'user-123',
      email: 'old@example.com',
      name: 'Old Name',
      provider: 'azure',
      attributes: {
        domain: 'example.com',
        roles: ['user'],
      },
      permissions: [],
    };
    
    const newData: RawUserData = {
      id: 'user-123',
      email: 'new@company.com',
      name: 'New Name',
      userPrincipalName: 'new@company.com',
      displayName: 'New Name',
      jobTitle: 'Manager',
      department: 'Management',
    };
    
    return updateUserProfile(currentUser, newData);
  },
};