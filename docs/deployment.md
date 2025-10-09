# Deployment Guide

This document provides comprehensive instructions for deploying the Dify Workflow Frontend application across different environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Build Process](#build-process)
4. [Deployment Environments](#deployment-environments)
5. [Monitoring and Analytics](#monitoring-and-analytics)
6. [Security Considerations](#security-considerations)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- Node.js 18+ (LTS recommended)
- npm 9+ or yarn 1.22+
- Git
- Modern web browser with ES2022 support

### Development Tools

- TypeScript 5+
- Vite 7+
- React Router v7
- React 19+

## Environment Configuration

### Required Environment Variables

Create environment files for each deployment stage:

#### `.env.development`
```bash
# Development Environment
VITE_MODE=development
VITE_AZURE_CLIENT_ID=your-azure-client-id
VITE_AZURE_TENANT_ID=your-azure-tenant-id
VITE_GITHUB_CLIENT_ID=your-github-client-id
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_DIFY_API_BASE_URL=http://localhost:3000/api
VITE_OAUTH_REDIRECT_URI=http://localhost:5173/callback
VITE_GIT_COMMIT=local-development
```

#### `.env.staging`
```bash
# Staging Environment
VITE_MODE=staging
VITE_AZURE_CLIENT_ID=your-staging-azure-client-id
VITE_AZURE_TENANT_ID=your-azure-tenant-id
VITE_GITHUB_CLIENT_ID=your-staging-github-client-id
VITE_GOOGLE_CLIENT_ID=your-staging-google-client-id
VITE_DIFY_API_BASE_URL=https://staging-api.example.com
VITE_OAUTH_REDIRECT_URI=https://staging.example.com/callback
VITE_GIT_COMMIT=${CI_COMMIT_SHA}
```

#### `.env.production`
```bash
# Production Environment
VITE_MODE=production
VITE_AZURE_CLIENT_ID=your-production-azure-client-id
VITE_AZURE_TENANT_ID=your-azure-tenant-id
VITE_GITHUB_CLIENT_ID=your-production-github-client-id
VITE_GOOGLE_CLIENT_ID=your-production-google-client-id
VITE_DIFY_API_BASE_URL=https://api.example.com
VITE_OAUTH_REDIRECT_URI=https://app.example.com/callback
VITE_GIT_COMMIT=${CI_COMMIT_SHA}
```

### OAuth Provider Configuration

#### Azure AD Configuration
1. Register application in Azure AD
2. Configure redirect URIs for each environment
3. Enable PKCE (Proof Key for Code Exchange)
4. Set required permissions: `User.Read`

#### GitHub OAuth Configuration
1. Create OAuth App in GitHub Developer Settings
2. Set Authorization callback URL for each environment
3. Configure required scopes: `user:email`, `read:user`

#### Google OAuth Configuration
1. Create project in Google Cloud Console
2. Enable Google+ API
3. Configure OAuth consent screen
4. Set authorized redirect URIs for each environment

## Build Process

### Development Build
```bash
npm run dev
# or
yarn dev
```

### Production Build
```bash
# Install dependencies
npm ci

# Run tests
npm run test

# Build for production
npm run build

# Preview production build (optional)
npm run preview
```

### Build Optimization Features

- **Code Splitting**: Automatic chunk splitting by route and feature
- **Tree Shaking**: Dead code elimination
- **Minification**: Terser minification for production
- **Source Maps**: Disabled in production for security
- **Bundle Analysis**: Use `npm run build:analyze` to analyze bundle size

### Build Output Structure
```
dist/
├── assets/
│   ├── react-vendor-[hash].js     # React and React Router
│   ├── auth-services-[hash].js    # Authentication services
│   ├── api-services-[hash].js     # API and workflow services
│   ├── ui-components-[hash].js    # UI components
│   └── workflow-components-[hash].js # Workflow components
├── index.html
└── vite.svg
```

## Deployment Environments

### Development Environment

**Purpose**: Local development and testing

**Configuration**:
- Hot module replacement enabled
- Source maps enabled
- Console logging enabled
- Security features relaxed
- Analytics disabled

**Deployment**:
```bash
npm run dev
```

### Staging Environment

**Purpose**: Pre-production testing and QA

**Configuration**:
- Production-like build
- Source maps enabled for debugging
- Security features enabled
- Analytics enabled with high sample rate
- Error tracking enabled

**Deployment**:
```bash
# Build for staging
npm run build:staging

# Deploy to staging server
npm run deploy:staging
```

### Production Environment

**Purpose**: Live application serving end users

**Configuration**:
- Optimized production build
- Source maps disabled
- All security features enabled
- Analytics enabled with low sample rate
- Error tracking enabled
- Performance monitoring enabled

**Deployment**:
```bash
# Build for production
npm run build:production

# Deploy to production server
npm run deploy:production
```

## Deployment Scripts

### Docker Deployment

#### Dockerfile
```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM nginx:alpine AS production

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Add security headers
COPY nginx-security.conf /etc/nginx/conf.d/security.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### docker-compose.yml
```yaml
version: '3.8'

services:
  frontend:
    build: .
    ports:
      - "80:80"
    environment:
      - NODE_ENV=production
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    restart: unless-stopped
    
  # Optional: Add reverse proxy for API
  api-proxy:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./proxy.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/ssl:ro
    depends_on:
      - frontend
```

### CI/CD Pipeline Examples

#### GitHub Actions
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run test
      - run: npm run test:integration

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run build:production
        env:
          VITE_AZURE_CLIENT_ID: ${{ secrets.AZURE_CLIENT_ID }}
          VITE_GITHUB_CLIENT_ID: ${{ secrets.GITHUB_CLIENT_ID }}
          VITE_GOOGLE_CLIENT_ID: ${{ secrets.GOOGLE_CLIENT_ID }}
          VITE_DIFY_API_BASE_URL: ${{ secrets.DIFY_API_BASE_URL }}
          VITE_GIT_COMMIT: ${{ github.sha }}
      
      - name: Deploy to S3
        run: aws s3 sync dist/ s3://${{ secrets.S3_BUCKET }} --delete
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      
      - name: Invalidate CloudFront
        run: aws cloudfront create-invalidation --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} --paths "/*"
```

## Monitoring and Analytics

### Analytics Integration

The application includes built-in analytics tracking:

- **Page Views**: Automatic tracking of route changes
- **User Actions**: Custom event tracking for important interactions
- **Workflow Execution**: Tracking of workflow usage and performance
- **Authentication Events**: Login/logout tracking by provider

### Error Tracking

Comprehensive error tracking includes:

- **JavaScript Errors**: Global error handler for unhandled exceptions
- **Promise Rejections**: Tracking of unhandled promise rejections
- **API Errors**: Automatic tracking of API failures
- **Authentication Errors**: OAuth and token management errors

### Performance Monitoring

Performance metrics tracked:

- **Page Load Times**: First paint, first contentful paint, DOM ready
- **API Response Times**: Tracking of all API calls
- **Component Render Times**: React component performance
- **Memory Usage**: JavaScript heap usage monitoring

### Configuration

Configure monitoring services in `src/config/deployment.ts`:

```typescript
monitoring: {
  enableAnalytics: true,
  enableErrorTracking: true,
  enablePerformanceMonitoring: true,
  sampleRate: 0.1, // 10% sampling for production
}
```

## Security Considerations

### Content Security Policy (CSP)

The application automatically generates CSP headers based on environment:

**Development CSP**: Relaxed for development tools
**Production CSP**: Strict policy with specific allowed sources

### OAuth Security

- **PKCE**: Enabled for all OAuth flows
- **State Parameter**: CSRF protection with secure random tokens
- **Token Storage**: Secure separation of access and refresh tokens
- **Session Security**: Suspicious activity detection and automatic logout

### API Security

- **Request Signing**: HMAC-SHA256 signing for sensitive requests
- **Rate Limiting**: Configurable rate limits per endpoint
- **Input Validation**: Comprehensive input sanitization
- **HTTPS Only**: All production traffic over HTTPS

### Security Headers

Automatic injection of security headers:

```
Content-Security-Policy: [generated based on environment]
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: [restricted permissions]
```

## Troubleshooting

### Common Issues

#### Build Failures

**Issue**: TypeScript compilation errors
**Solution**: 
```bash
# Clear TypeScript cache
rm -rf node_modules/.cache
npm run type-check
```

**Issue**: Vite build fails with memory errors
**Solution**:
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

#### Runtime Errors

**Issue**: OAuth redirect fails
**Solution**: 
1. Verify redirect URIs in OAuth provider settings
2. Check environment variables are correctly set
3. Ensure HTTPS in production

**Issue**: API calls fail with CORS errors
**Solution**:
1. Configure API server CORS settings
2. Verify API base URL in environment variables
3. Check network connectivity

#### Performance Issues

**Issue**: Slow initial page load
**Solution**:
1. Enable route preloading: `enableRoutePreloading: true`
2. Optimize chunk splitting in `vite.config.ts`
3. Enable service worker caching

**Issue**: High memory usage
**Solution**:
1. Monitor memory usage in performance monitoring
2. Check for memory leaks in React components
3. Optimize large data structures

### Debug Mode

Enable debug mode for troubleshooting:

```bash
# Development
VITE_DEBUG=true npm run dev

# Production (not recommended)
VITE_DEBUG=true npm run build
```

### Health Checks

The application provides health check endpoints:

- `/health` - Basic application health
- `/health/detailed` - Detailed system information
- `/version` - Build and version information

### Logging

Configure logging levels:

```typescript
// In deployment configuration
logging: {
  level: 'info', // 'debug', 'info', 'warn', 'error'
  enableConsole: true,
  enableRemote: true,
}
```

## Support and Maintenance

### Regular Maintenance Tasks

1. **Dependency Updates**: Monthly security updates
2. **Performance Review**: Weekly performance metrics analysis
3. **Error Monitoring**: Daily error rate monitoring
4. **Security Audit**: Quarterly security assessment

### Monitoring Dashboards

Set up monitoring dashboards for:

- Application performance metrics
- Error rates and types
- User engagement analytics
- Security events and alerts

### Backup and Recovery

- **Code**: Git repository with proper branching strategy
- **Configuration**: Environment variables in secure storage
- **Monitoring Data**: Regular exports of analytics and error data

For additional support, refer to the project documentation or contact the development team.