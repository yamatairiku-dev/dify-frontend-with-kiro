import {
  UserAttributeService,
  UserAttributeValidationError,
  AzureUserData,
  GitHubUserData,
  GoogleUserData,
  RawUserData,
} from '../userAttributeService';
import { AuthProviderType, User } from '../../types/auth';

describe('UserAttributeService', () => {
  let service: UserAttributeService;

  beforeEach(() => {
    service = new UserAttributeService();
  });

  describe('extractUserAttributes', () => {
    describe('Azure AD provider', () => {
      const azureUserData: AzureUserData = {
        id: 'azure-user-123',
        email: 'john.doe@company.com',
        name: 'John Doe',
        userPrincipalName: 'john.doe@company.com',
        displayName: 'John Doe',
        givenName: 'John',
        surname: 'Doe',
        jobTitle: 'Senior Developer',
        department: 'Engineering',
        companyName: 'Tech Corp',
        mail: 'john.doe@company.com',
      };

      it('should extract user attributes from Azure AD data', () => {
        const result = service.extractUserAttributes(azureUserData, 'azure');

        expect(result).toEqual({
          id: 'azure-user-123',
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

      it('should handle Azure data with missing optional fields', () => {
        const minimalData: AzureUserData = {
          id: 'azure-user-456',
          email: 'jane@example.com',
          name: 'Jane Smith',
          userPrincipalName: 'jane@example.com',
          displayName: 'Jane Smith',
        };

        const result = service.extractUserAttributes(minimalData, 'azure');

        expect(result.attributes).toEqual({
          domain: 'example.com',
          roles: [],
          department: undefined,
          organization: undefined,
        });
      });

      it('should use userPrincipalName when mail is not available', () => {
        const dataWithoutMail: AzureUserData = {
          ...azureUserData,
          mail: undefined,
        };

        const result = service.extractUserAttributes(dataWithoutMail, 'azure');

        expect(result.email).toBe('john.doe@company.com');
        expect(result.attributes.domain).toBe('company.com');
      });
    });

    describe('GitHub provider', () => {
      const githubUserData: GitHubUserData = {
        id: '12345',
        email: 'developer@github.com',
        name: 'GitHub Developer',
        login: 'dev-user',
        avatar_url: 'https://github.com/avatar.jpg',
        html_url: 'https://github.com/dev-user',
        company: 'Open Source Inc',
        public_repos: 25,
        followers: 100,
        following: 50,
      };

      it('should extract user attributes from GitHub data', () => {
        const result = service.extractUserAttributes(githubUserData, 'github');

        expect(result).toEqual({
          id: '12345',
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

      it('should handle GitHub user with minimal activity', () => {
        const minimalData: GitHubUserData = {
          ...githubUserData,
          public_repos: 2,
          followers: 5,
        };

        const result = service.extractUserAttributes(minimalData, 'github');

        expect(result.attributes.roles).toEqual(['developer']);
      });

      it('should use login as name when name is not provided', () => {
        const dataWithoutName: GitHubUserData = {
          ...githubUserData,
          name: '',
        };

        const result = service.extractUserAttributes(dataWithoutName, 'github');

        expect(result.name).toBe('dev-user');
      });
    });

    describe('Google provider', () => {
      const googleUserData: GoogleUserData = {
        id: 'google-123',
        email: 'user@gmail.com',
        name: 'Google User',
        sub: 'google-123',
        given_name: 'Google',
        family_name: 'User',
        picture: 'https://google.com/photo.jpg',
        hd: 'company.com',
      };

      it('should extract user attributes from Google data', () => {
        const result = service.extractUserAttributes(googleUserData, 'google');

        expect(result).toEqual({
          id: 'google-123',
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

      it('should handle Google user without G Suite domain', () => {
        const personalData: GoogleUserData = {
          ...googleUserData,
          hd: undefined,
        };

        const result = service.extractUserAttributes(personalData, 'google');

        expect(result.attributes).toEqual({
          domain: 'gmail.com',
          roles: ['user'],
          organization: undefined,
        });
      });

      it('should construct name from given_name and family_name when name is missing', () => {
        const dataWithoutName: GoogleUserData = {
          ...googleUserData,
          name: '',
        };

        const result = service.extractUserAttributes(dataWithoutName, 'google');

        expect(result.name).toBe('Google User');
      });
    });
  });

  describe('validation', () => {
    it('should throw error for missing required fields', () => {
      const invalidData = {
        id: 'test-id',
        // missing email and name
      } as RawUserData;

      expect(() => {
        service.extractUserAttributes(invalidData, 'azure');
      }).toThrow(UserAttributeValidationError);
    });

    it('should throw error for invalid email format', () => {
      const invalidData: RawUserData = {
        id: 'test-id',
        email: 'invalid-email',
        name: 'Test User',
      };

      expect(() => {
        service.extractUserAttributes(invalidData, 'azure');
      }).toThrow(UserAttributeValidationError);
    });

    it('should throw error for empty required fields', () => {
      const invalidData: RawUserData = {
        id: '',
        email: 'test@example.com',
        name: 'Test User',
      };

      expect(() => {
        service.extractUserAttributes(invalidData, 'azure');
      }).toThrow(UserAttributeValidationError);
    });

    it('should validate email format correctly', () => {
      const validEmails = [
        'user@example.com',
        'test.email@domain.co.uk',
        'user+tag@example.org',
      ];

      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user@.com',
        'user..double@example.com',
      ];

      validEmails.forEach(email => {
        const data: RawUserData = {
          id: 'test-id',
          email,
          name: 'Test User',
        };

        expect(() => {
          service.extractUserAttributes(data, 'azure');
        }).not.toThrow();
      });

      invalidEmails.forEach(email => {
        const data: RawUserData = {
          id: 'test-id',
          email,
          name: 'Test User',
        };

        expect(() => {
          service.extractUserAttributes(data, 'azure');
        }).toThrow(UserAttributeValidationError);
      });
    });
  });

  describe('updateUserAttributes', () => {
    it('should update user attributes with new data', () => {
      const currentUser: User = {
        id: 'user-123',
        email: 'old@example.com',
        name: 'Old Name',
        provider: 'azure',
        attributes: {
          domain: 'example.com',
          roles: ['old_role'],
          department: 'Old Dept',
        },
        permissions: [],
      };

      const newRawData: AzureUserData = {
        id: 'user-123',
        email: 'new@company.com',
        name: 'New Name',
        userPrincipalName: 'new@company.com',
        displayName: 'New Name',
        jobTitle: 'Manager',
        department: 'Management',
        companyName: 'New Corp',
      };

      const result = service.updateUserAttributes(currentUser, newRawData);

      expect(result.attributes).toEqual({
        domain: 'company.com',
        roles: ['manager', 'management_member'],
        department: 'Management',
        organization: 'New Corp',
      });
    });
  });

  describe('mergeAttributes', () => {
    it('should merge attributes correctly', () => {
      const baseAttributes = {
        domain: 'example.com',
        roles: ['user'],
        department: 'Engineering',
        organization: 'Old Corp',
      };

      const newAttributes = {
        roles: ['admin', 'user'],
        organization: 'New Corp',
      };

      const result = service.mergeAttributes(baseAttributes, newAttributes);

      expect(result).toEqual({
        domain: 'example.com',
        roles: ['admin', 'user'],
        department: 'Engineering',
        organization: 'New Corp',
      });
    });

    it('should handle undefined values in new attributes', () => {
      const baseAttributes = {
        domain: 'example.com',
        roles: ['user'],
        department: 'Engineering',
        organization: 'Corp',
      };

      const newAttributes = {
        department: undefined,
      };

      const result = service.mergeAttributes(baseAttributes, newAttributes);

      expect(result).toEqual({
        domain: 'example.com',
        roles: ['user'],
        department: undefined,
        organization: 'Corp',
      });
    });
  });

  describe('error handling', () => {
    it('should throw UserAttributeValidationError with correct properties', () => {
      const invalidData = {
        id: 'test-id',
        email: 'invalid-email',
        name: 'Test User',
      } as RawUserData;

      try {
        service.extractUserAttributes(invalidData, 'azure');
        fail('Expected UserAttributeValidationError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(UserAttributeValidationError);
        expect((error as UserAttributeValidationError).field).toBe('email');
        expect((error as UserAttributeValidationError).provider).toBe('azure');
        expect((error as UserAttributeValidationError).message).toContain('Invalid email format');
      }
    });

    it('should throw error for unsupported provider', () => {
      const data: RawUserData = {
        id: 'test-id',
        email: 'test@example.com',
        name: 'Test User',
      };

      expect(() => {
        service.extractUserAttributes(data, 'unsupported' as AuthProviderType);
      }).toThrow('Unsupported provider: unsupported');
    });
  });

  describe('domain extraction', () => {
    it('should extract domain correctly from various email formats', () => {
      const testCases = [
        { email: 'user@example.com', expectedDomain: 'example.com' },
        { email: 'test@subdomain.example.org', expectedDomain: 'subdomain.example.org' },
        { email: 'user+tag@domain.co.uk', expectedDomain: 'domain.co.uk' },
      ];

      testCases.forEach(({ email, expectedDomain }) => {
        const data: RawUserData = {
          id: 'test-id',
          email,
          name: 'Test User',
        };

        const result = service.extractUserAttributes(data, 'azure');
        expect(result.attributes.domain).toBe(expectedDomain);
      });
    });
  });
});