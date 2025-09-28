import { userAttributeService } from '../services/userAttributeService';
import { accessControlService } from '../services/accessControlService';
import { AuthProviderType } from '../types/auth';

/**
 * Example demonstrating the integration between user attribute extraction
 * and access control service for complete user permission management
 */

// Example raw user data from different providers
const azureUserData = {
  id: 'azure-123',
  email: 'john.doe@company.com',
  name: 'John Doe',
  userPrincipalName: 'john.doe@company.com',
  displayName: 'John Doe',
  jobTitle: 'Senior Developer',
  department: 'Engineering',
  companyName: 'Company Inc',
};

const githubUserData = {
  id: '456',
  email: 'jane.smith@example.com',
  name: 'Jane Smith',
  login: 'janesmith',
  avatar_url: 'https://github.com/avatars/janesmith',
  html_url: 'https://github.com/janesmith',
  company: 'Example Corp',
  public_repos: 25,
  followers: 150,
};

const googleUserData = {
  id: 'google-789',
  email: 'admin@example.com',
  name: 'Admin User',
  sub: 'google-789',
  given_name: 'Admin',
  family_name: 'User',
  hd: 'example.com', // G Suite domain
};

/**
 * Complete user onboarding flow: extract attributes and assign permissions
 */
export function completeUserOnboarding(
  rawUserData: any,
  provider: AuthProviderType
) {
  console.log(`\n=== User Onboarding for ${provider.toUpperCase()} ===`);
  
  // Step 1: Extract user attributes from OAuth provider data
  const user = userAttributeService.extractUserAttributes(rawUserData, provider);
  console.log('1. User attributes extracted:', {
    email: user.email,
    domain: user.attributes.domain,
    roles: user.attributes.roles,
    department: user.attributes.department,
    organization: user.attributes.organization,
  });

  // Step 2: Update user permissions based on domain and attributes
  const userWithPermissions = accessControlService.updateUserPermissions(user);
  console.log('2. Permissions assigned:', userWithPermissions.permissions);

  // Step 3: Check available services
  const availableServices = accessControlService.getAvailableServices(userWithPermissions);
  console.log('3. Available services:', availableServices);

  // Step 4: Get available workflows
  const availableWorkflows = accessControlService.getAvailableWorkflows(userWithPermissions);
  console.log('4. Available workflows:', availableWorkflows.map(w => ({
    id: w.id,
    name: w.name,
    requiredPermissions: w.requiredPermissions,
  })));

  return userWithPermissions;
}

/**
 * Demonstrate access control checks for different scenarios
 */
export function demonstrateAccessControl(user: any) {
  console.log(`\n=== Access Control Demo for ${user.email} ===`);

  // Test various access scenarios
  const accessTests = [
    { resource: 'workflow', action: 'read' },
    { resource: 'workflow', action: 'execute' },
    { resource: 'workflow', action: 'delete' },
    { resource: 'user', action: 'read' },
    { resource: 'admin', action: 'read' },
    { resource: 'profile', action: 'update' },
  ];

  accessTests.forEach(test => {
    const result = accessControlService.checkAccess(user, test.resource, test.action);
    console.log(`${test.resource}:${test.action} -> ${result.allowed ? '✅ ALLOWED' : '❌ DENIED'}${
      result.reason ? ` (${result.reason})` : ''
    }`);
  });

  // Test service access
  const serviceTests = ['dify-workflow', 'analytics', 'restricted-service'];
  serviceTests.forEach(service => {
    const canAccess = accessControlService.canAccessService(user, service);
    console.log(`Service '${service}' -> ${canAccess ? '✅ ALLOWED' : '❌ DENIED'}`);
  });
}

/**
 * Demonstrate dynamic permission updates
 */
export function demonstratePermissionUpdates() {
  console.log('\n=== Dynamic Permission Updates Demo ===');

  // Create a user with basic permissions
  const basicUser = userAttributeService.extractUserAttributes(githubUserData, 'github');
  const userWithBasicPermissions = accessControlService.updateUserPermissions(basicUser);
  
  console.log('Initial permissions:', userWithBasicPermissions.permissions.length);

  // Add a new domain mapping for the user's domain
  accessControlService.updateDomainMapping({
    domain: 'example.com',
    allowedServices: ['dify-workflow', 'analytics', 'new-service'],
    defaultPermissions: [
      {
        resource: 'workflow',
        actions: ['read', 'execute'],
      },
      {
        resource: 'analytics',
        actions: ['read'],
      },
    ],
    roleBasedPermissions: {
      active_developer: [
        {
          resource: 'workflow',
          actions: ['create', 'update'],
        },
      ],
      community_member: [
        {
          resource: 'community',
          actions: ['read', 'post'],
        },
      ],
    },
  });

  // Update user permissions with new mapping
  const userWithUpdatedPermissions = accessControlService.updateUserPermissions(basicUser);
  console.log('Updated permissions:', userWithUpdatedPermissions.permissions.length);
  console.log('New permissions:', userWithUpdatedPermissions.permissions);

  // Test access to new services
  const newServices = accessControlService.getAvailableServices(userWithUpdatedPermissions);
  console.log('Available services after update:', newServices);
}

/**
 * Demonstrate role-based access control
 */
export function demonstrateRoleBasedAccess() {
  console.log('\n=== Role-Based Access Control Demo ===');

  // Create users with different roles
  const developerData = { ...azureUserData, jobTitle: 'Developer' };
  const adminData = { ...azureUserData, jobTitle: 'Admin', email: 'admin@company.com' };

  const developer = userAttributeService.extractUserAttributes(developerData, 'azure');
  const admin = userAttributeService.extractUserAttributes(adminData, 'azure');

  // Update domain mapping to include admin role
  accessControlService.updateDomainMapping({
    domain: 'company.com',
    allowedServices: ['dify-workflow'],
    defaultPermissions: [
      {
        resource: 'workflow',
        actions: ['read'],
        conditions: [
          {
            attribute: 'attributes.department',
            operator: 'equals',
            value: ['Engineering', 'Product'],
          },
        ],
      },
    ],
    roleBasedPermissions: {
      admin: [
        {
          resource: 'workflow',
          actions: ['*'],
        },
        {
          resource: 'user',
          actions: ['read', 'update', 'delete'],
        },
      ],
      developer: [
        {
          resource: 'workflow',
          actions: ['execute', 'create'],
        },
      ],
    },
  });

  const developerWithPermissions = accessControlService.updateUserPermissions(developer);
  const adminWithPermissions = accessControlService.updateUserPermissions(admin);

  console.log('Developer permissions:', developerWithPermissions.permissions);
  console.log('Admin permissions:', adminWithPermissions.permissions);

  // Compare access levels
  const testActions = [
    { resource: 'workflow', action: 'read' },
    { resource: 'workflow', action: 'delete' },
    { resource: 'user', action: 'delete' },
  ];

  testActions.forEach(test => {
    const devAccess = accessControlService.checkAccess(developerWithPermissions, test.resource, test.action);
    const adminAccess = accessControlService.checkAccess(adminWithPermissions, test.resource, test.action);
    
    console.log(`${test.resource}:${test.action}`);
    console.log(`  Developer: ${devAccess.allowed ? '✅' : '❌'}`);
    console.log(`  Admin: ${adminAccess.allowed ? '✅' : '❌'}`);
  });
}

/**
 * Run all integration examples
 */
export function runAccessControlIntegrationExamples() {
  console.log('🚀 Access Control Integration Examples\n');

  // Onboard users from different providers
  const azureUser = completeUserOnboarding(azureUserData, 'azure');
  const githubUser = completeUserOnboarding(githubUserData, 'github');
  const googleUser = completeUserOnboarding(googleUserData, 'google');

  // Demonstrate access control for each user
  demonstrateAccessControl(azureUser);
  demonstrateAccessControl(githubUser);
  demonstrateAccessControl(googleUser);

  // Demonstrate dynamic updates
  demonstratePermissionUpdates();

  // Demonstrate role-based access
  demonstrateRoleBasedAccess();

  console.log('\n✅ Access Control Integration Examples Complete');
}

// Export for testing and demonstration
export {
  azureUserData,
  githubUserData,
  googleUserData,
};