# OAuth Provider Implementation Guide

## Overview

This document describes the OAuth 2.0/OpenID Connect implementation for Azure AD, GitHub, and Google authentication providers in the Dify Workflow Frontend application.

## Architecture

The OAuth implementation consists of several key components:

### 1. OAuth Service (`src/services/oauth.ts`)
- Handles OAuth flow initiation
- Generates secure authorization URLs with PKCE
- Manages OAuth session state
- Validates callback parameters

### 2. OAuth Redirect Utilities (`src/utils/oauth-redirect.ts`)
- Parses OAuth callback URLs
- Handles OAuth errors and validation
- Provides user-friendly error messages
- Manages OAuth login flow

### 3. Provider Configurations (`src/config/oauth-providers.ts`)
- Provider-specific configurations
- Scope definitions and descriptions
- User attribute extraction
- Error handling strategies

## Supported Providers

### Azure AD (Microsoft)
- **Scopes**: `openid`, `profile`, `email`, `User.Read`
- **Features**: PKCE support, refresh tokens, tenant-specific authentication
- **User Info**: Email, name, department, organization, job title

### GitHub
- **Scopes**: `user:email`, `read:user`
- **Features**: Basic OAuth 2.0 (no PKCE), no refresh tokens
- **User Info**: Email, name, organization, location, public repos

### Google
- **Scopes**: `openid`, `profile`, `email`
- **Features**: PKCE support, refresh tokens, offline access
- **User Info**: Email, name, picture, locale, verification status

## Security Features

### PKCE (Proof Key for Code Exchange)
- Implemented for Azure AD and Google (GitHub doesn't support PKCE)
- Uses SHA-256 code challenge method
- Cryptographically secure random code verifier generation

### State Parameter Validation
- Cryptographically secure random state generation
- State validation on callback to prevent CSRF attacks
- Session-based state storage

### Secure Token Storage
- Session storage for temporary OAuth parameters
- Automatic cleanup after successful authentication
- No sensitive data in localStorage

## Environment Configuration

### Required Environment Variables

```bash
# Azure AD Configuration
VITE_AZURE_CLIENT_ID=your-azure-client-id
VITE_AZURE_TENANT_ID=your-azure-tenant-id

# GitHub Configuration
VITE_GITHUB_CLIENT_ID=your-github-client-id

# Google Configuration
VITE_GOOGLE_CLIENT_ID=your-google-client-id

# Common Configuration
VITE_OAUTH_REDIRECT_URI=http://localhost:5173/callback
```

### Environment-Specific Configuration

The application supports different configurations for:
- Development (`VITE_NODE_ENV=development`)
- Staging (`VITE_NODE_ENV=staging`)
- Production (`VITE_NODE_ENV=production`)

## OAuth Flow Implementation

### 1. Login Initiation
```typescript
import { initiateOAuthLogin } from '../utils/oauth-redirect';

// Redirect user to OAuth provider
await initiateOAuthLogin('azure'); // or 'github', 'google'
```

### 2. Callback Handling
```typescript
import { parseOAuthCallback, handleOAuthCallback } from '../utils/oauth-redirect';

// Parse callback URL
const callbackParams = parseOAuthCallback(window.location.href);

// Validate and handle callback
const result = handleOAuthCallback(callbackParams);

if (result.isValid) {
  // Exchange code for user information
  const userInfo = await exchangeCodeForUserInfo(result.code!, result.provider);
} else {
  // Handle error
  console.error(result.error);
}
```

### 3. User Information Exchange
```typescript
import { exchangeCodeForUserInfo } from '../utils/oauth-redirect';

// Exchange authorization code for user info (calls backend API)
const userInfo = await exchangeCodeForUserInfo(code, provider);
```

## Error Handling

### OAuth Error Types
- `access_denied`: User denied access
- `invalid_request`: Malformed OAuth request
- `invalid_client`: Client configuration error
- `server_error`: Provider server error
- `temporarily_unavailable`: Provider temporarily unavailable

### Provider-Specific Errors
Each provider has specific error handling:
- **Azure AD**: Consent required, tenant issues, interaction required
- **GitHub**: Application suspended, redirect URI mismatch
- **Google**: Admin policy enforced, disallowed user agent

### Error Message Localization
User-friendly error messages are provided for all error types:

```typescript
import { getOAuthErrorMessage } from '../utils/oauth-redirect';

const userMessage = getOAuthErrorMessage('access_denied', 'azure');
// Returns: "You denied access to your azure account. Please try again and grant the necessary permissions."
```

## Configuration Validation

### Runtime Validation
```typescript
import { validateOAuthConfig } from '../utils/oauth-redirect';

const validation = validateOAuthConfig('azure');
if (!validation.isValid) {
  console.error('Missing OAuth configuration:', validation.missingFields);
}
```

### Required Configuration Fields
- **All Providers**: `clientId`, `redirectUri`
- **Azure AD**: Additional `tenantId` required
- **GitHub**: No additional fields
- **Google**: No additional fields

## Provider Display Information

```typescript
import { getProviderDisplayInfo } from '../utils/oauth-redirect';

const info = getProviderDisplayInfo('azure');
// Returns: { name: 'Microsoft Azure', icon: '🔷', color: '#0078d4' }
```

## Testing

### Unit Tests
- OAuth service functionality
- Redirect utility functions
- Provider configuration validation
- Error handling scenarios

### Test Coverage
- Authorization URL generation
- PKCE implementation
- State validation
- Callback parsing
- Error message generation

### Running Tests
```bash
npm test -- --testPathPatterns="oauth"
```

## Integration with AuthContext

The OAuth implementation integrates with the existing AuthContext:

```typescript
// In AuthContext.tsx
import { initiateOAuthLogin } from '../utils/oauth-redirect';

const login = useCallback(async (provider: AuthProviderType): Promise<void> => {
  dispatch({ type: 'LOGIN_START' });
  
  try {
    // Initiate OAuth login by redirecting to provider
    await initiateOAuthLogin(provider);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Login failed';
    dispatch({ type: 'LOGIN_FAILURE', payload: errorMessage });
    throw error;
  }
}, []);
```

## Backend API Integration

The OAuth implementation expects a backend API endpoint for token exchange:

### Expected Endpoint: `POST /api/auth/oauth/exchange`

**Request Body:**
```json
{
  "code": "authorization_code",
  "provider": "azure|github|google",
  "codeVerifier": "pkce_code_verifier",
  "redirectUri": "callback_uri"
}
```

**Response:**
```json
{
  "id": "user_id",
  "email": "user@example.com",
  "name": "User Name",
  "provider": "azure",
  "attributes": {
    "domain": "example.com",
    "roles": ["user"],
    "department": "Engineering",
    "organization": "Example Corp"
  }
}
```

## Security Considerations

### CSRF Protection
- State parameter validation prevents CSRF attacks
- Cryptographically secure random state generation
- Session-based state storage

### Code Injection Prevention
- All URL parameters are properly encoded
- Input validation on all callback parameters
- No eval() or similar dangerous functions

### Token Security
- No long-lived tokens stored in browser
- Automatic cleanup of OAuth session data
- PKCE prevents authorization code interception

## Troubleshooting

### Common Issues

1. **Redirect URI Mismatch**
   - Ensure `VITE_OAUTH_REDIRECT_URI` matches provider configuration
   - Check for trailing slashes and protocol differences

2. **Invalid Client Configuration**
   - Verify client IDs are correct for each environment
   - Ensure Azure tenant ID is properly configured

3. **CORS Issues**
   - OAuth providers handle redirects, so CORS shouldn't be an issue
   - Backend API must handle CORS for token exchange endpoint

4. **State Validation Errors**
   - Check that sessionStorage is available and working
   - Ensure state parameter is preserved during redirect

### Debug Mode
Enable debug logging by setting:
```bash
VITE_ENABLE_DEBUG_MODE=true
VITE_LOG_LEVEL=debug
```

## Future Enhancements

### Planned Features
1. **Additional Providers**: Support for more OAuth providers
2. **Token Refresh**: Automatic token refresh implementation
3. **Session Management**: Advanced session timeout and renewal
4. **Multi-Factor Authentication**: Support for MFA flows
5. **Single Sign-Out**: Implement proper logout across providers

### Performance Optimizations
1. **Lazy Loading**: Load provider-specific code on demand
2. **Caching**: Cache provider configurations
3. **Prefetching**: Prefetch provider discovery documents

## Compliance and Standards

### OAuth 2.0 Compliance
- Follows RFC 6749 (OAuth 2.0 Authorization Framework)
- Implements RFC 7636 (PKCE) for enhanced security
- Supports OpenID Connect 1.0 for identity providers

### Security Standards
- OWASP OAuth 2.0 Security Best Practices
- Secure by default configuration
- Regular security audits and updates