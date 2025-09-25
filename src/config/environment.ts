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

const getEnvironmentConfig = (): EnvironmentConfig => {
  const env = import.meta.env;

  return {
    appName: env['VITE_APP_NAME'] || 'Dify Workflow Frontend',
    appVersion: env['VITE_APP_VERSION'] || '1.0.0',
    nodeEnv: env['VITE_NODE_ENV'] || 'development',
    apiBaseUrl: env['VITE_API_BASE_URL'] || 'http://localhost:3001',
    difyApiUrl: env['VITE_DIFY_API_URL'] || 'http://localhost:8080',
    oauthConfig: {
      azure: {
        clientId: env['VITE_AZURE_CLIENT_ID'] || '',
        tenantId: env['VITE_AZURE_TENANT_ID'] || '',
      },
      github: {
        clientId: env['VITE_GITHUB_CLIENT_ID'] || '',
      },
      google: {
        clientId: env['VITE_GOOGLE_CLIENT_ID'] || '',
      },
      redirectUri:
        env['VITE_OAUTH_REDIRECT_URI'] || 'http://localhost:5173/callback',
    },
    security: {
      sessionTimeout: parseInt(env['VITE_SESSION_TIMEOUT'] || '30', 10),
      maxLoginAttempts: parseInt(env['VITE_MAX_LOGIN_ATTEMPTS'] || '3', 10),
    },
    features: {
      enableAnalytics: env['VITE_ENABLE_ANALYTICS'] === 'true',
      enableDebugMode: env['VITE_ENABLE_DEBUG_MODE'] === 'true',
    },
    logLevel:
      (env['VITE_LOG_LEVEL'] as 'debug' | 'info' | 'warn' | 'error') || 'info',
  };
};

export const config = getEnvironmentConfig();
