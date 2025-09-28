import { AuthProviderType, User, UserAttributes } from '../types/auth';

/**
 * Raw user data from different OAuth providers
 */
export interface RawUserData {
  // Common fields
  id: string;
  email: string;
  name: string;
  
  // Provider-specific fields
  [key: string]: any;
}

/**
 * Azure AD specific user data structure
 */
export interface AzureUserData extends RawUserData {
  userPrincipalName: string;
  displayName: string;
  givenName?: string;
  surname?: string;
  jobTitle?: string;
  department?: string;
  companyName?: string;
  officeLocation?: string;
  mail?: string;
  mailNickname?: string;
}

/**
 * GitHub specific user data structure
 */
export interface GitHubUserData extends RawUserData {
  login: string;
  avatar_url: string;
  html_url: string;
  company?: string;
  location?: string;
  bio?: string;
  public_repos: number;
  followers: number;
  following: number;
}

/**
 * Google specific user data structure
 */
export interface GoogleUserData extends RawUserData {
  sub: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
  hd?: string; // hosted domain for G Suite users
}

/**
 * Validation error for user attributes
 */
export class UserAttributeValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly provider: AuthProviderType
  ) {
    super(message);
    this.name = 'UserAttributeValidationError';
  }
}

/**
 * Service for extracting and processing user attributes from OAuth providers
 */
export class UserAttributeService {
  /**
   * Extract and normalize user attributes from raw OAuth provider data
   */
  extractUserAttributes(
    rawData: RawUserData,
    provider: AuthProviderType
  ): User {
    // Extract normalized user data first (handles provider-specific logic)
    const normalizedData = this.normalizeUserData(rawData, provider);

    // Validate required fields after normalization
    this.validateRequiredFields(normalizedData, provider);

    // Extract user attributes
    const attributes = this.extractAttributes(rawData, provider);

    // Validate extracted attributes
    this.validateAttributes(attributes, provider);

    return {
      id: normalizedData.id,
      email: normalizedData.email,
      name: normalizedData.name,
      provider,
      attributes,
      permissions: [], // Will be populated by access control service
    };
  }

  /**
   * Validate required fields are present in raw data
   */
  private validateRequiredFields(
    rawData: RawUserData,
    provider: AuthProviderType
  ): void {
    const requiredFields = ['id', 'email', 'name'];

    for (const field of requiredFields) {
      if (!rawData[field] || typeof rawData[field] !== 'string') {
        throw new UserAttributeValidationError(
          `Missing or invalid required field: ${field}`,
          field,
          provider
        );
      }
    }

    // Validate email format
    if (!this.isValidEmail(rawData.email)) {
      throw new UserAttributeValidationError(
        `Invalid email format: ${rawData.email}`,
        'email',
        provider
      );
    }
  }

  /**
   * Normalize user data across different providers
   */
  private normalizeUserData(
    rawData: RawUserData,
    provider: AuthProviderType
  ): { id: string; email: string; name: string } {
    switch (provider) {
      case 'azure':
        return this.normalizeAzureData(rawData as AzureUserData);
      case 'github':
        return this.normalizeGitHubData(rawData as GitHubUserData);
      case 'google':
        return this.normalizeGoogleData(rawData as GoogleUserData);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Normalize Azure AD user data
   */
  private normalizeAzureData(data: AzureUserData): { id: string; email: string; name: string } {
    return {
      id: data.id,
      email: data.mail || data.userPrincipalName || data.email,
      name: data.displayName || data.name,
    };
  }

  /**
   * Normalize GitHub user data
   */
  private normalizeGitHubData(data: GitHubUserData): { id: string; email: string; name: string } {
    return {
      id: data.id.toString(),
      email: data.email,
      name: data.name || data.login,
    };
  }

  /**
   * Normalize Google user data
   */
  private normalizeGoogleData(data: GoogleUserData): { id: string; email: string; name: string } {
    return {
      id: data.sub || data.id,
      email: data.email,
      name: data.name || `${data.given_name || ''} ${data.family_name || ''}`.trim(),
    };
  }

  /**
   * Extract user attributes from provider-specific data
   */
  private extractAttributes(
    rawData: RawUserData,
    provider: AuthProviderType
  ): UserAttributes {
    switch (provider) {
      case 'azure':
        return this.extractAzureAttributes(rawData as AzureUserData);
      case 'github':
        return this.extractGitHubAttributes(rawData as GitHubUserData);
      case 'google':
        return this.extractGoogleAttributes(rawData as GoogleUserData);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Extract attributes from Azure AD user data
   */
  private extractAzureAttributes(data: AzureUserData): UserAttributes {
    const email = data.mail || data.userPrincipalName || data.email;
    const domain = this.extractEmailDomain(email);

    const roles: string[] = [];
    
    // Extract roles from job title if available
    if (data.jobTitle) {
      roles.push(data.jobTitle.toLowerCase());
    }

    // Add department-based role if available
    if (data.department) {
      roles.push(`${data.department.toLowerCase()}_member`);
    }

    return {
      domain,
      roles,
      department: data.department,
      organization: data.companyName,
    };
  }

  /**
   * Extract attributes from GitHub user data
   */
  private extractGitHubAttributes(data: GitHubUserData): UserAttributes {
    const domain = this.extractEmailDomain(data.email);

    const roles: string[] = ['developer'];

    // Add role based on public repository count
    if (data.public_repos > 10) {
      roles.push('active_developer');
    }

    // Add role based on follower count
    if (data.followers > 50) {
      roles.push('community_member');
    }

    return {
      domain,
      roles,
      organization: data.company || undefined,
    };
  }

  /**
   * Extract attributes from Google user data
   */
  private extractGoogleAttributes(data: GoogleUserData): UserAttributes {
    const domain = this.extractEmailDomain(data.email);

    const roles: string[] = ['user'];

    // Add G Suite role if hosted domain is present
    if (data.hd) {
      roles.push('gsuite_user');
    }

    return {
      domain,
      roles,
      organization: data.hd || undefined,
    };
  }

  /**
   * Extract domain from email address
   */
  private extractEmailDomain(email: string): string {
    const domain = email.split('@')[1];
    if (!domain) {
      throw new UserAttributeValidationError(
        `Invalid email format: ${email}`,
        'email',
        'unknown' as AuthProviderType
      );
    }
    return domain.toLowerCase();
  }

  /**
   * Validate extracted user attributes
   */
  private validateAttributes(
    attributes: UserAttributes,
    provider: AuthProviderType
  ): void {
    // Validate domain
    if (!attributes.domain || typeof attributes.domain !== 'string') {
      throw new UserAttributeValidationError(
        'Missing or invalid domain attribute',
        'domain',
        provider
      );
    }

    // Validate roles array
    if (!Array.isArray(attributes.roles)) {
      throw new UserAttributeValidationError(
        'Roles must be an array',
        'roles',
        provider
      );
    }

    // Validate each role is a string
    for (const role of attributes.roles) {
      if (typeof role !== 'string') {
        throw new UserAttributeValidationError(
          'All roles must be strings',
          'roles',
          provider
        );
      }
    }

    // Validate optional fields if present
    if (attributes.department && typeof attributes.department !== 'string') {
      throw new UserAttributeValidationError(
        'Department must be a string',
        'department',
        provider
      );
    }

    if (attributes.organization && typeof attributes.organization !== 'string') {
      throw new UserAttributeValidationError(
        'Organization must be a string',
        'organization',
        provider
      );
    }
  }

  /**
   * Validate email format using regex
   */
  private isValidEmail(email: string): boolean {
    // More comprehensive email validation
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email) && !email.includes('..');
  }

  /**
   * Update user attributes with new data
   */
  updateUserAttributes(
    currentUser: User,
    newRawData: RawUserData
  ): User {
    const updatedAttributes = this.extractAttributes(newRawData, currentUser.provider);
    this.validateAttributes(updatedAttributes, currentUser.provider);

    return {
      ...currentUser,
      attributes: updatedAttributes,
    };
  }

  /**
   * Merge attributes from multiple sources (useful for profile updates)
   */
  mergeAttributes(
    baseAttributes: UserAttributes,
    newAttributes: Partial<UserAttributes>
  ): UserAttributes {
    return {
      domain: newAttributes.domain || baseAttributes.domain,
      roles: newAttributes.roles || baseAttributes.roles,
      department: Object.prototype.hasOwnProperty.call(newAttributes, 'department')
        ? newAttributes.department 
        : baseAttributes.department,
      organization: Object.prototype.hasOwnProperty.call(newAttributes, 'organization')
        ? newAttributes.organization
        : baseAttributes.organization,
    };
  }
}

export const userAttributeService = new UserAttributeService();