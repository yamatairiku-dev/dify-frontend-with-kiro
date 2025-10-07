import { AuthProviderType, OAuthConfig } from '../types/auth';
import { config } from '../config/environment';
import { CSRFProtection } from './securityService';

/**
 * OAuth service for handling authentication with multiple providers
 */
export class OAuthService {
  private readonly config: OAuthConfig;

  constructor() {
    this.config = {
      azure: {
        clientId: config.oauthConfig.azure.clientId,
        tenantId: config.oauthConfig.azure.tenantId,
        redirectUri: config.oauthConfig.redirectUri,
        scopes: [
          'openid',
          'profile',
          'email',
          'User.Read',
        ],
      },
      github: {
        clientId: config.oauthConfig.github.clientId,
        redirectUri: config.oauthConfig.redirectUri,
        scopes: [
          'user:email',
          'read:user',
        ],
      },
      google: {
        clientId: config.oauthConfig.google.clientId,
        redirectUri: config.oauthConfig.redirectUri,
        scopes: [
          'openid',
          'profile',
          'email',
        ],
      },
    };
  }

  /**
   * Generate OAuth authorization URL for the specified provider
   */
  async getAuthorizationUrl(provider: AuthProviderType): Promise<string> {
    const state = CSRFProtection.generateSecureOAuthState(provider);
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    // Store PKCE parameters in sessionStorage for later verification
    sessionStorage.setItem('oauth_state', state);
    sessionStorage.setItem('oauth_code_verifier', codeVerifier);
    sessionStorage.setItem('oauth_provider', provider);

    switch (provider) {
      case 'azure':
        return this.getAzureAuthUrl(state, codeChallenge);
      case 'github':
        return this.getGitHubAuthUrl(state);
      case 'google':
        return this.getGoogleAuthUrl(state, codeChallenge);
      default:
        throw new Error(`Unsupported OAuth provider: ${provider}`);
    }
  }

  /**
   * Generate Azure AD authorization URL
   */
  private getAzureAuthUrl(state: string, codeChallenge: string): string {
    const params = new URLSearchParams({
      client_id: this.config.azure.clientId,
      response_type: 'code',
      redirect_uri: this.config.azure.redirectUri,
      scope: this.config.azure.scopes.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      response_mode: 'query',
    });

    const baseUrl = `https://login.microsoftonline.com/${this.config.azure.tenantId}/oauth2/v2.0/authorize`;
    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Generate GitHub authorization URL
   */
  private getGitHubAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.github.clientId,
      redirect_uri: this.config.github.redirectUri,
      scope: this.config.github.scopes.join(' '),
      state,
      allow_signup: 'false', // Only allow existing GitHub users
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Generate Google authorization URL
   */
  private getGoogleAuthUrl(state: string, codeChallenge: string): string {
    const params = new URLSearchParams({
      client_id: this.config.google.clientId,
      response_type: 'code',
      redirect_uri: this.config.google.redirectUri,
      scope: this.config.google.scopes.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Generate cryptographically secure random state parameter
   */
  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate PKCE code verifier
   */
  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Generate PKCE code challenge from verifier
   */
  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hash);
    return btoa(String.fromCharCode.apply(null, Array.from(hashArray)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Validate OAuth callback parameters with enhanced CSRF protection
   */
  validateCallback(
    code: string,
    state: string,
    provider: AuthProviderType
  ): boolean {
    const storedState = sessionStorage.getItem('oauth_state');
    const storedProvider = sessionStorage.getItem('oauth_provider');

    if (!storedState || !storedProvider) {
      throw new Error('Missing OAuth state or provider in session');
    }

    if (state !== storedState) {
      throw new Error('Invalid OAuth state parameter');
    }

    if (provider !== storedProvider) {
      throw new Error('OAuth provider mismatch');
    }

    // Enhanced CSRF validation
    if (!CSRFProtection.validateOAuthState(state, provider)) {
      throw new Error('CSRF validation failed for OAuth callback');
    }

    return true;
  }

  /**
   * Get stored PKCE code verifier for token exchange
   */
  getCodeVerifier(): string {
    const verifier = sessionStorage.getItem('oauth_code_verifier');
    if (!verifier) {
      throw new Error('Missing OAuth code verifier in session');
    }
    return verifier;
  }

  /**
   * Clear OAuth session data including CSRF tokens
   */
  clearOAuthSession(): void {
    sessionStorage.removeItem('oauth_state');
    sessionStorage.removeItem('oauth_code_verifier');
    sessionStorage.removeItem('oauth_provider');
    
    // Clear provider-specific OAuth state
    ['azure', 'github', 'google'].forEach(provider => {
      sessionStorage.removeItem(`oauth_state_${provider}`);
    });
    
    // Clear CSRF token
    CSRFProtection.clearCSRFToken();
  }

  /**
   * Get provider configuration
   */
  getProviderConfig(provider: AuthProviderType): OAuthConfig[AuthProviderType] {
    return this.config[provider];
  }
}

export const oauthService = new OAuthService();