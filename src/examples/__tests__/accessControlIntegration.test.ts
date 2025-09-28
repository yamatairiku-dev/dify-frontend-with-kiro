import {
  completeUserOnboarding,
  demonstrateAccessControl,
  demonstratePermissionUpdates,
  demonstrateRoleBasedAccess,
  runAccessControlIntegrationExamples,
  azureUserData,
  githubUserData,
  googleUserData,
} from '../accessControlIntegration';
import { accessControlService } from '../../services/accessControlService';

// Mock console.log to capture output for testing
const mockConsoleLog = jest.fn();
const originalConsoleLog = console.log;

describe('Access Control Integration', () => {
  beforeEach(() => {
    console.log = mockConsoleLog;
    mockConsoleLog.mockClear();
    
    // Reset access control service to default state
    accessControlService.updateConfig(accessControlService.getConfig());
  });

  afterAll(() => {
    console.log = originalConsoleLog;
  });

  describe('completeUserOnboarding', () => {
    it('should complete Azure user onboarding with proper permissions', () => {
      const user = completeUserOnboarding(azureUserData, 'azure');

      expect(user.email).toBe('john.doe@company.com');
      expect(user.attributes.domain).toBe('company.com');
      expect(user.attributes.roles).toContain('senior developer');
      expect(user.attributes.department).toBe('Engineering');
      expect(user.permissions.length).toBeGreaterThan(0);
      
      // Check console output
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('User Onboarding for AZURE')
      );
    });

    it('should complete GitHub user onboarding with developer permissions', () => {
      const user = completeUserOnboarding(githubUserData, 'github');

      expect(user.email).toBe('jane.smith@example.com');
      expect(user.attributes.domain).toBe('example.com');
      expect(user.attributes.roles).toContain('developer');
      expect(user.attributes.roles).toContain('active_developer');
      expect(user.attributes.roles).toContain('community_member');
      expect(user.permissions.length).toBeGreaterThan(0);
    });

    it('should complete Google user onboarding with G Suite permissions', () => {
      const user = completeUserOnboarding(googleUserData, 'google');

      expect(user.email).toBe('admin@example.com');
      expect(user.attributes.domain).toBe('example.com');
      expect(user.attributes.roles).toContain('user');
      expect(user.attributes.roles).toContain('gsuite_user');
      expect(user.attributes.organization).toBe('example.com');
      expect(user.permissions.length).toBeGreaterThan(0);
    });
  });

  describe('demonstrateAccessControl', () => {
    it('should demonstrate access control for a user with permissions', () => {
      const user = completeUserOnboarding(azureUserData, 'azure');
      
      demonstrateAccessControl(user);

      // Check that access control checks were logged
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Access Control Demo')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/workflow:read -> [✅❌]/)
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Service 'dify-workflow' -> [✅❌]/)
      );
    });

    it('should show different access levels for different users', () => {
      const azureUser = completeUserOnboarding(azureUserData, 'azure');
      const githubUser = completeUserOnboarding(githubUserData, 'github');

      mockConsoleLog.mockClear();
      demonstrateAccessControl(azureUser);
      const azureOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

      mockConsoleLog.mockClear();
      demonstrateAccessControl(githubUser);
      const githubOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

      // Users from different domains should have different access patterns
      expect(azureOutput).not.toBe(githubOutput);
    });
  });

  describe('demonstratePermissionUpdates', () => {
    it('should show dynamic permission updates', () => {
      demonstratePermissionUpdates();

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Dynamic Permission Updates Demo')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        'Initial permissions:', expect.any(Number)
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        'Updated permissions:', expect.any(Number)
      );
    });

    it('should actually update permissions when domain mapping changes', () => {
      // Use a user from a domain that doesn't have initial mapping
      const testUserData = { ...githubUserData, email: 'test@newdomain.com' };
      const initialUser = completeUserOnboarding(testUserData, 'github');
      const initialPermissionCount = initialUser.permissions.length;

      // Add a new domain mapping
      accessControlService.updateDomainMapping({
        domain: 'newdomain.com',
        allowedServices: ['new-service'],
        defaultPermissions: [
          {
            resource: 'new-resource',
            actions: ['read'],
          },
        ],
      });

      // Create a new user with the same data to see updated permissions
      const updatedUser = completeUserOnboarding(testUserData, 'github');
      
      // Should have different permissions after domain mapping update
      expect(updatedUser.permissions.length).toBeGreaterThan(initialPermissionCount);
    });
  });

  describe('demonstrateRoleBasedAccess', () => {
    it('should show different access levels for different roles', () => {
      demonstrateRoleBasedAccess();

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Role-Based Access Control Demo')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        'Developer permissions:', expect.any(Array)
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        'Admin permissions:', expect.any(Array)
      );
      
      // Should show comparison between developer and admin access
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Developer: [✅❌]/)
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Admin: [✅❌]/)
      );
    });
  });

  describe('runAccessControlIntegrationExamples', () => {
    it('should run all integration examples without errors', () => {
      expect(() => {
        runAccessControlIntegrationExamples();
      }).not.toThrow();

      // Should have logged the start and completion messages
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Access Control Integration Examples')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Access Control Integration Examples Complete')
      );
    });

    it('should demonstrate all major features', () => {
      runAccessControlIntegrationExamples();

      const allOutput = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');

      // Should include all major demo sections
      expect(allOutput).toContain('User Onboarding for AZURE');
      expect(allOutput).toContain('User Onboarding for GITHUB');
      expect(allOutput).toContain('User Onboarding for GOOGLE');
      expect(allOutput).toContain('Access Control Demo');
      expect(allOutput).toContain('Dynamic Permission Updates Demo');
      expect(allOutput).toContain('Role-Based Access Control Demo');
    });
  });

  describe('data validation', () => {
    it('should have valid test data for all providers', () => {
      expect(azureUserData).toHaveProperty('id');
      expect(azureUserData).toHaveProperty('email');
      expect(azureUserData).toHaveProperty('userPrincipalName');
      expect(azureUserData).toHaveProperty('department');

      expect(githubUserData).toHaveProperty('id');
      expect(githubUserData).toHaveProperty('email');
      expect(githubUserData).toHaveProperty('login');
      expect(githubUserData).toHaveProperty('public_repos');

      expect(googleUserData).toHaveProperty('id');
      expect(googleUserData).toHaveProperty('email');
      expect(googleUserData).toHaveProperty('sub');
      expect(googleUserData).toHaveProperty('hd');
    });

    it('should create valid users from all test data', () => {
      expect(() => completeUserOnboarding(azureUserData, 'azure')).not.toThrow();
      expect(() => completeUserOnboarding(githubUserData, 'github')).not.toThrow();
      expect(() => completeUserOnboarding(googleUserData, 'google')).not.toThrow();
    });
  });

  describe('permission consistency', () => {
    it('should maintain permission consistency across operations', () => {
      const user1 = completeUserOnboarding(azureUserData, 'azure');
      const user2 = completeUserOnboarding(azureUserData, 'azure');

      // Same input should produce same permissions
      expect(user1.permissions).toEqual(user2.permissions);
    });

    it('should handle permission updates correctly', () => {
      const user = completeUserOnboarding(githubUserData, 'github');
      const originalPermissions = [...user.permissions];

      // Update domain mapping
      accessControlService.updateDomainMapping({
        domain: 'example.com',
        allowedServices: ['new-service'],
        defaultPermissions: [
          {
            resource: 'new-resource',
            actions: ['read'],
          },
        ],
      });

      // Get updated permissions
      const updatedUser = accessControlService.updateUserPermissions(user);

      // Should have different permissions
      expect(updatedUser.permissions).not.toEqual(originalPermissions);
      
      // Should include new resource
      expect(updatedUser.permissions.some(p => p.resource === 'new-resource')).toBe(true);
    });
  });
});