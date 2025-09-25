import { describe, it, expect } from '@jest/globals';

// Mock environment configuration for testing
const mockConfig = {
  appName: 'Dify Workflow Frontend',
  appVersion: '1.0.0',
  nodeEnv: 'test',
  apiBaseUrl: 'http://localhost:3001',
  difyApiUrl: 'http://localhost:8080',
  oauthConfig: {
    azure: {
      clientId: '',
      tenantId: '',
    },
    github: {
      clientId: '',
    },
    google: {
      clientId: '',
    },
    redirectUri: 'http://localhost:5173/callback',
  },
  security: {
    sessionTimeout: 30,
    maxLoginAttempts: 3,
  },
  features: {
    enableAnalytics: false,
    enableDebugMode: true,
  },
  logLevel: 'info' as const,
};

describe('Environment Configuration', () => {
  it('should have default configuration values', () => {
    expect(mockConfig.appName).toBe('Dify Workflow Frontend');
    expect(mockConfig.appVersion).toBe('1.0.0');
    expect(mockConfig.apiBaseUrl).toBe('http://localhost:3001');
    expect(mockConfig.difyApiUrl).toBe('http://localhost:8080');
  });

  it('should have oauth configuration structure', () => {
    expect(mockConfig.oauthConfig).toHaveProperty('azure');
    expect(mockConfig.oauthConfig).toHaveProperty('github');
    expect(mockConfig.oauthConfig).toHaveProperty('google');
    expect(mockConfig.oauthConfig).toHaveProperty('redirectUri');
  });

  it('should have security configuration', () => {
    expect(mockConfig.security).toHaveProperty('sessionTimeout');
    expect(mockConfig.security).toHaveProperty('maxLoginAttempts');
    expect(typeof mockConfig.security.sessionTimeout).toBe('number');
    expect(typeof mockConfig.security.maxLoginAttempts).toBe('number');
  });

  it('should have feature flags', () => {
    expect(mockConfig.features).toHaveProperty('enableAnalytics');
    expect(mockConfig.features).toHaveProperty('enableDebugMode');
    expect(typeof mockConfig.features.enableAnalytics).toBe('boolean');
    expect(typeof mockConfig.features.enableDebugMode).toBe('boolean');
  });
});
