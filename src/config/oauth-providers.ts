import { AuthProviderType } from '../types/auth';

/**
 * OAuth provider-specific configurations and utilities
 */

/**
 * Azure AD OAuth configuration
 */
export const azureConfig = {
  name: 'Microsoft Azure AD',
  authorizationEndpoint: 'https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/authorize',
  tokenEndpoint: 'https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token',
  userInfoEndpoint: 'https://graph.microsoft.com/v1.0/me',
  scopes: [
    'openid',
    'profile', 
    'email',
    'User.Read',
  ],
  scopeDescription: {
    'openid': 'Sign you in',
    'profile': 'View your basic profile',
    'email': 'View your email address',
    'User.Read': 'Read your profile information',
  },
  requiredClaims: ['email', 'name', 'preferred_username'],
  supportsPKCE: true,
  supportsRefreshToken: true,
};

/**
 * GitHub OAuth configuration
 */
export const githubConfig = {
  name: 'GitHub',
  authorizationEndpoint: 'https://github.com/login/oauth/authorize',
  tokenEndpoint: 'https://github.com/login/oauth/access_token',
  userInfoEndpoint: 'https://api.github.com/user',
  emailEndpoint: 'https://api.github.com/user/emails',
  scopes: [
    'user:email',
    'read:user',
  ],
  scopeDescription: {
    'user:email': 'Access your email addresses',
    'read:user': 'Read your profile information',
  },
  requiredClaims: ['login', 'email', 'name'],
  supportsPKCE: false,
  supportsRefreshToken: false,
};

/**
 * Google OAuth configuration
 */
export const googleConfig = {
  name: 'Google',
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  userInfoEndpoint: 'https://www.googleapis.com/oauth2/v2/userinfo',
  scopes: [
    'openid',
    'profile',
    'email',
  ],
  scopeDescription: {
    'openid': 'Authenticate your identity',
    'profile': 'View your basic profile info',
    'email': 'View your email address',
  },
  requiredClaims: ['email', 'name', 'picture'],
  supportsPKCE: true,
  supportsRefreshToken: true,
};

/**
 * Get provider configuration by type
 */
export function getProviderConfig(provider: AuthProviderType) {
  switch (provider) {
    case 'azure':
      return azureConfig;
    case 'github':
      return githubConfig;
    case 'google':
      return googleConfig;
    default:
      throw new Error(`Unsupported OAuth provider: ${provider}`);
  }
}

/**
 * Validate provider-specific requirements
 */
export function validateProviderRequirements(provider: AuthProviderType, userInfo: any): {
  isValid: boolean;
  missingClaims: string[];
} {
  const config = getProviderConfig(provider);
  const missingClaims: string[] = [];

  for (const claim of config.requiredClaims) {
    if (!userInfo[claim]) {
      missingClaims.push(claim);
    }
  }

  return {
    isValid: missingClaims.length === 0,
    missingClaims,
  };
}

/**
 * Extract user attributes from provider-specific user info
 */
export function extractUserAttributes(provider: AuthProviderType, userInfo: any) {
  switch (provider) {
    case 'azure':
      return extractAzureAttributes(userInfo);
    case 'github':
      return extractGitHubAttributes(userInfo);
    case 'google':
      return extractGoogleAttributes(userInfo);
    default:
      throw new Error(`Unsupported provider for attribute extraction: ${provider}`);
  }
}

/**
 * Extract user attributes from Azure AD user info
 */
function extractAzureAttributes(userInfo: any) {
  const email = userInfo.mail || userInfo.userPrincipalName || userInfo.email;
  const domain = email ? email.split('@')[1] : '';
  
  return {
    id: userInfo.id,
    email,
    name: userInfo.displayName || userInfo.name,
    domain,
    roles: userInfo.roles || [],
    department: userInfo.department,
    organization: userInfo.companyName || userInfo.organizationName,
    jobTitle: userInfo.jobTitle,
    officeLocation: userInfo.officeLocation,
  };
}

/**
 * Extract user attributes from GitHub user info
 */
function extractGitHubAttributes(userInfo: any) {
  const email = userInfo.email;
  const domain = email ? email.split('@')[1] : '';
  
  return {
    id: userInfo.id.toString(),
    email,
    name: userInfo.name || userInfo.login,
    domain,
    roles: [], // GitHub doesn't provide role information
    organization: userInfo.company,
    location: userInfo.location,
    bio: userInfo.bio,
    publicRepos: userInfo.public_repos,
  };
}

/**
 * Extract user attributes from Google user info
 */
function extractGoogleAttributes(userInfo: any) {
  const email = userInfo.email;
  const domain = email ? email.split('@')[1] : '';
  
  return {
    id: userInfo.id,
    email,
    name: userInfo.name,
    domain,
    roles: [], // Google doesn't provide role information in basic profile
    firstName: userInfo.given_name,
    lastName: userInfo.family_name,
    picture: userInfo.picture,
    locale: userInfo.locale,
    verified: userInfo.verified_email,
  };
}

/**
 * Get provider-specific error handling
 */
export function getProviderErrorHandler(provider: AuthProviderType) {
  switch (provider) {
    case 'azure':
      return handleAzureErrors;
    case 'github':
      return handleGitHubErrors;
    case 'google':
      return handleGoogleErrors;
    default:
      return handleGenericErrors;
  }
}

/**
 * Handle Azure AD specific errors
 */
function handleAzureErrors(error: string, errorDescription?: string): string {
  const azureErrors: Record<string, string> = {
    'invalid_tenant': 'The Azure AD tenant is not configured correctly.',
    'consent_required': 'Administrator consent is required for this application.',
    'interaction_required': 'Additional user interaction is required.',
    'login_required': 'User must sign in again.',
    'account_selection_required': 'User must select an account.',
    'invalid_client': 'The Azure AD application configuration is invalid.',
  };

  return azureErrors[error] || errorDescription || `Azure AD error: ${error}`;
}

/**
 * Handle GitHub specific errors
 */
function handleGitHubErrors(error: string, errorDescription?: string): string {
  const githubErrors: Record<string, string> = {
    'application_suspended': 'The GitHub application has been suspended.',
    'redirect_uri_mismatch': 'The redirect URI does not match the configured URI.',
    'access_denied': 'You denied access to your GitHub account.',
    'incorrect_client_credentials': 'The GitHub application credentials are incorrect.',
  };

  return githubErrors[error] || errorDescription || `GitHub error: ${error}`;
}

/**
 * Handle Google specific errors
 */
function handleGoogleErrors(error: string, errorDescription?: string): string {
  const googleErrors: Record<string, string> = {
    'redirect_uri_mismatch': 'The redirect URI does not match the configured URI.',
    'invalid_client': 'The Google OAuth client configuration is invalid.',
    'access_denied': 'You denied access to your Google account.',
    'admin_policy_enforced': 'Access blocked by administrator policy.',
    'disallowed_useragent': 'The request is from a disallowed user agent.',
  };

  return googleErrors[error] || errorDescription || `Google error: ${error}`;
}

/**
 * Handle generic OAuth errors
 */
function handleGenericErrors(error: string, errorDescription?: string): string {
  return errorDescription || `OAuth error: ${error}`;
}

/**
 * Get provider capabilities
 */
export function getProviderCapabilities(provider: AuthProviderType) {
  const config = getProviderConfig(provider);
  
  return {
    supportsPKCE: config.supportsPKCE,
    supportsRefreshToken: config.supportsRefreshToken,
    scopes: config.scopes,
    scopeDescriptions: config.scopeDescription,
    requiredClaims: config.requiredClaims,
  };
}