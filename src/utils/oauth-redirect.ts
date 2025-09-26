import { AuthProviderType } from '../types/auth';
import { oauthService } from '../services/oauth';

/**
 * OAuth redirect handling utilities
 */

/**
 * Parse OAuth callback URL parameters
 */
export interface OAuthCallbackParams {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
  provider: AuthProviderType;
}

/**
 * Parse OAuth callback parameters from URL
 */
export function parseOAuthCallback(url: string): OAuthCallbackParams {
  const urlObj = new URL(url);
  const params = urlObj.searchParams;
  
  // Extract provider from pathname (e.g., /callback/azure)
  const pathParts = urlObj.pathname.split('/');
  const provider = pathParts[pathParts.length - 1] as AuthProviderType;

  if (!['azure', 'github', 'google'].includes(provider)) {
    throw new Error(`Invalid OAuth provider in callback URL: ${provider}`);
  }

  return {
    code: params.get('code') || undefined,
    state: params.get('state') || undefined,
    error: params.get('error') || undefined,
    error_description: params.get('error_description') || undefined,
    provider,
  };
}

/**
 * Handle OAuth callback and validate parameters
 */
export function handleOAuthCallback(callbackParams: OAuthCallbackParams): {
  isValid: boolean;
  error?: string;
  code?: string;
  provider: AuthProviderType;
} {
  const { code, state, error, error_description, provider } = callbackParams;

  // Check for OAuth errors
  if (error) {
    const errorMessage = error_description || `OAuth error: ${error}`;
    return {
      isValid: false,
      error: errorMessage,
      provider,
    };
  }

  // Validate required parameters
  if (!code || !state) {
    return {
      isValid: false,
      error: 'Missing required OAuth parameters (code or state)',
      provider,
    };
  }

  try {
    // Validate state and provider
    oauthService.validateCallback(code, state, provider);
    
    return {
      isValid: true,
      code,
      provider,
    };
  } catch (validationError) {
    return {
      isValid: false,
      error: validationError instanceof Error ? validationError.message : 'OAuth validation failed',
      provider,
    };
  }
}

/**
 * Generate OAuth login URL for a provider
 */
export async function generateOAuthLoginUrl(provider: AuthProviderType): Promise<string> {
  try {
    return await oauthService.getAuthorizationUrl(provider);
  } catch (error) {
    throw new Error(
      `Failed to generate OAuth URL for ${provider}: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Initiate OAuth login by redirecting to provider
 */
export async function initiateOAuthLogin(provider: AuthProviderType): Promise<void> {
  try {
    const authUrl = await generateOAuthLoginUrl(provider);
    window.location.href = authUrl;
  } catch (error) {
    throw new Error(
      `Failed to initiate OAuth login for ${provider}: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Extract user information from OAuth provider response
 * This is a placeholder - actual implementation would depend on backend API
 */
export interface OAuthUserInfo {
  id: string;
  email: string;
  name: string;
  provider: AuthProviderType;
  attributes: {
    domain: string;
    roles: string[];
    department?: string;
    organization?: string;
  };
}

/**
 * Exchange authorization code for user information
 * This would typically call your backend API
 */
export async function exchangeCodeForUserInfo(
  code: string,
  provider: AuthProviderType
): Promise<OAuthUserInfo> {
  const codeVerifier = oauthService.getCodeVerifier();
  const providerConfig = oauthService.getProviderConfig(provider);

  // This would be replaced with actual backend API call
  const response = await fetch('/api/auth/oauth/exchange', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      provider,
      codeVerifier,
      redirectUri: providerConfig.redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to exchange OAuth code: ${response.statusText}`);
  }

  const userInfo = await response.json() as OAuthUserInfo;
  
  // Clean up OAuth session data after successful exchange
  oauthService.clearOAuthSession();
  
  return userInfo;
}

/**
 * Handle OAuth errors with user-friendly messages
 */
export function getOAuthErrorMessage(error: string, provider: AuthProviderType): string {
  const errorMessages: Record<string, string> = {
    access_denied: `You denied access to your ${provider} account. Please try again and grant the necessary permissions.`,
    invalid_request: 'The OAuth request was invalid. Please try logging in again.',
    invalid_client: `There was a problem with the ${provider} OAuth configuration. Please contact support.`,
    invalid_grant: 'The authorization code has expired or is invalid. Please try logging in again.',
    unsupported_response_type: `The ${provider} OAuth configuration is incorrect. Please contact support.`,
    invalid_scope: `The requested permissions for ${provider} are not available. Please contact support.`,
    server_error: `${provider} is experiencing technical difficulties. Please try again later.`,
    temporarily_unavailable: `${provider} is temporarily unavailable. Please try again later.`,
  };

  return errorMessages[error] || `An unexpected error occurred during ${provider} authentication. Please try again.`;
}

/**
 * Validate OAuth configuration for a provider
 */
export function validateOAuthConfig(provider: AuthProviderType): {
  isValid: boolean;
  missingFields: string[];
} {
  const config = oauthService.getProviderConfig(provider);
  const missingFields: string[] = [];

  if (!config.clientId) {
    missingFields.push('clientId');
  }

  if (!config.redirectUri) {
    missingFields.push('redirectUri');
  }

  if (provider === 'azure' && 'tenantId' in config && !config.tenantId) {
    missingFields.push('tenantId');
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Get OAuth provider display information
 */
export function getProviderDisplayInfo(provider: AuthProviderType): {
  name: string;
  icon: string;
  color: string;
} {
  const providerInfo = {
    azure: {
      name: 'Microsoft Azure',
      icon: '🔷',
      color: '#0078d4',
    },
    github: {
      name: 'GitHub',
      icon: '🐙',
      color: '#24292e',
    },
    google: {
      name: 'Google',
      icon: '🔍',
      color: '#4285f4',
    },
  };

  return providerInfo[provider];
}