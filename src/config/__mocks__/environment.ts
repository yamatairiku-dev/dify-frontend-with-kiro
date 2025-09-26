// Mock for environment configuration in Jest tests
export interface EnvironmentConfig {
  appName: string;
  appVersion: string;
  nodeEnv: string;
  apiBaseUrl: string;
  difyApiUrl: string;
  oauthConfig: {
    azure: {
      clientId: string;
      tenantId: string;
    };
    github: {
      clientId: string;
    };
    google: {
      clientId: string;
    };
    redirectUri: string;
  };
  security: {
    sessionTimeout: number;
    maxLoginAttempts: number;
  };
  features: {
    enableAnalytics: boolean;
    enableDebugMode: boolean;
  };
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export const config: EnvironmentConfig = {
  appName: 'Dify Workflow Frontend Test',
  appVersion: '1.0.0',
  nodeEnv: 'test',
  apiBaseUrl: 'http://localhost:3001',
  difyApiUrl: 'http://localhost:8080',
  oauthConfig: {
    azure: {
      clientId: 'test-azure-client-id',
      tenantId: 'test-azure-tenant-id',
    },
    github: {
      clientId: 'test-github-client-id',
    },
    google: {
      clientId: 'test-google-client-id',
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
  logLevel: 'debug',
};