import {
  processOAuthCallback,
  updateUserProfile,
  checkUserAccess,
  examples,
} from '../userAttributeIntegration';
import { User } from '../../types/auth';

describe('User Attribute Integration Examples', () => {
  describe('processOAuthCallback', () => {
    it('should process Azure AD callback correctly', async () => {
      const user = await processOAuthCallback('azure', 'test-code');
      
      expect(user).toEqual({
        id: 'azure-123',
        email: 'john.doe@company.com',
        name: 'John Doe',
        provider: 'azure',
        attributes: {
          domain: 'company.com',
          roles: ['senior developer', 'engineering_member'],
          department: 'Engineering',
          organization: 'Tech Corp',
        },
        permissions: [],
      });
    });

    it('should process GitHub callback correctly', async () => {
      const user = await processOAuthCallback('github', 'test-code');
      
      expect(user).toEqual({
        id: '456789',
        email: 'developer@github.com',
        name: 'GitHub Developer',
        provider: 'github',
        attributes: {
          domain: 'github.com',
          roles: ['developer', 'active_developer', 'community_member'],
          organization: 'Open Source Inc',
        },
        permissions: [],
      });
    });

    it('should process Google callback correctly', async () => {
      const user = await processOAuthCallback('google', 'test-code');
      
      expect(user).toEqual({
        id: 'google-789',
        email: 'user@gmail.com',
        name: 'Google User',
        provider: 'google',
        attributes: {
          domain: 'gmail.com',
          roles: ['user', 'gsuite_user'],
          organization: 'company.com',
        },
        permissions: [],
      });
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile correctly', () => {
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

      const newData = {
        id: 'user-123',
        email: 'new@company.com',
        name: 'New Name',
        userPrincipalName: 'new@company.com',
        displayName: 'New Name',
        jobTitle: 'Manager',
        department: 'Management',
      };

      const updatedUser = updateUserProfile(currentUser, newData);

      expect(updatedUser.attributes).toEqual({
        domain: 'company.com',
        roles: ['manager', 'management_member'],
        department: 'Management',
        organization: undefined,
      });
    });
  });

  describe('checkUserAccess', () => {
    const adminUser: User = {
      id: 'admin-123',
      email: 'admin@company.com',
      name: 'Admin User',
      provider: 'azure',
      attributes: {
        domain: 'company.com',
        roles: ['admin'],
      },
      permissions: [],
    };

    const developerUser: User = {
      id: 'dev-123',
      email: 'dev@company.com',
      name: 'Developer User',
      provider: 'github',
      attributes: {
        domain: 'company.com',
        roles: ['developer'],
      },
      permissions: [],
    };

    const regularUser: User = {
      id: 'user-123',
      email: 'user@other.com',
      name: 'Regular User',
      provider: 'google',
      attributes: {
        domain: 'other.com',
        roles: ['user'],
      },
      permissions: [],
    };

    it('should grant access to admin users', () => {
      expect(checkUserAccess(adminUser)).toBe(true);
      expect(checkUserAccess(adminUser, 'company.com')).toBe(true);
    });

    it('should grant access to developers', () => {
      expect(checkUserAccess(developerUser)).toBe(true);
      expect(checkUserAccess(developerUser, 'company.com')).toBe(true);
    });

    it('should deny access to regular users without required roles', () => {
      expect(checkUserAccess(regularUser)).toBe(false);
    });

    it('should deny access when domain requirement is not met', () => {
      expect(checkUserAccess(developerUser, 'other-company.com')).toBe(false);
    });
  });

  describe('examples', () => {
    it('should run Azure login example', async () => {
      const result = await examples.azureLogin();
      expect(result).toBe(true); // Should have access with senior developer role and company.com domain
    });

    it('should run GitHub login example', async () => {
      const result = await examples.githubLogin();
      expect(result).toBe(true); // Should have access with developer role
    });

    it('should run profile update example', async () => {
      const result = await examples.profileUpdate();
      expect(result.attributes.domain).toBe('company.com');
      expect(result.attributes.roles).toContain('manager');
    });
  });
});