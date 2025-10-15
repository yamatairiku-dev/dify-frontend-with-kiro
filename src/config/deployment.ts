/**
 * Deployment Configuration Management
 * Handles environment-specific configurations for different deployment stages
 */

export interface DeploymentConfig {
  environment: 'development' | 'staging' | 'production';
  api: {
    baseUrl: string;
    timeout: number;
    retryAttempts: number;
    enableRequestSigning: boolean;
  };
  auth: {
    sessionTimeout: number;
    tokenRefreshBuffer: number;
    enableSuspiciousActivityDetection: boolean;
  };
  security: {
    enableCSP: boolean;
    enableRateLimiting: boolean;
    rateLimits: {
      oauth: number;
      api: number;
      workflow: number;
    };
  };
  monitoring: {
    enableAnalytics: boolean;
    enableErrorTracking: boolean;
    enablePerformanceMonitoring: boolean;
    sampleRate: number;
  };
  features: {
    enableOptimizedComponents: boolean;
    enableRoutePreloading: boolean;
    enableServiceWorker: boolean;
  };
}

const developmentConfig: DeploymentConfig = {
  environment: 'development',
  api: {
    baseUrl: import.meta.env['VITE_DIFY_API_BASE_URL'] || 'http://localhost:3000/api',
    timeout: 30000,
    retryAttempts: 2,
    enableRequestSigning: false,
  },
  auth: {
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
    tokenRefreshBuffer: 5 * 60 * 1000, // 5 minutes
    enableSuspiciousActivityDetection: false,
  },
  security: {
    enableCSP: false,
    enableRateLimiting: false,
    rateLimits: {
      oauth: 10,
      api: 100,
      workflow: 50,
    },
  },
  monitoring: {
    enableAnalytics: false,
    enableErrorTracking: true,
    enablePerformanceMonitoring: true,
    sampleRate: 1.0,
  },
  features: {
    enableOptimizedComponents: true,
    enableRoutePreloading: true,
    enableServiceWorker: false,
  },
};

const stagingConfig: DeploymentConfig = {
  environment: 'staging',
  api: {
    baseUrl: import.meta.env['VITE_DIFY_API_BASE_URL'] || 'https://staging-api.example.com',
    timeout: 15000,
    retryAttempts: 3,
    enableRequestSigning: true,
  },
  auth: {
    sessionTimeout: 8 * 60 * 60 * 1000, // 8 hours
    tokenRefreshBuffer: 5 * 60 * 1000, // 5 minutes
    enableSuspiciousActivityDetection: true,
  },
  security: {
    enableCSP: true,
    enableRateLimiting: true,
    rateLimits: {
      oauth: 5,
      api: 60,
      workflow: 30,
    },
  },
  monitoring: {
    enableAnalytics: true,
    enableErrorTracking: true,
    enablePerformanceMonitoring: true,
    sampleRate: 0.5,
  },
  features: {
    enableOptimizedComponents: true,
    enableRoutePreloading: true,
    enableServiceWorker: true,
  },
};

const productionConfig: DeploymentConfig = {
  environment: 'production',
  api: {
    baseUrl: import.meta.env['VITE_DIFY_API_BASE_URL'] || 'https://api.example.com',
    timeout: 10000,
    retryAttempts: 3,
    enableRequestSigning: true,
  },
  auth: {
    sessionTimeout: 4 * 60 * 60 * 1000, // 4 hours
    tokenRefreshBuffer: 5 * 60 * 1000, // 5 minutes
    enableSuspiciousActivityDetection: true,
  },
  security: {
    enableCSP: true,
    enableRateLimiting: true,
    rateLimits: {
      oauth: 5,
      api: 60,
      workflow: 30,
    },
  },
  monitoring: {
    enableAnalytics: true,
    enableErrorTracking: true,
    enablePerformanceMonitoring: true,
    sampleRate: 0.1,
  },
  features: {
    enableOptimizedComponents: true,
    enableRoutePreloading: true,
    enableServiceWorker: true,
  },
};

/**
 * Get deployment configuration based on current environment
 */
export function getDeploymentConfig(): DeploymentConfig {
  const mode = import.meta.env.MODE || 'development';
  
  switch (mode) {
    case 'staging':
      return stagingConfig;
    case 'production':
      return productionConfig;
    default:
      return developmentConfig;
  }
}

/**
 * Validate required environment variables
 */
export function validateEnvironmentConfig(): { isValid: boolean; missingVars: string[] } {
  const requiredVars = [
    'VITE_AZURE_CLIENT_ID',
    'VITE_GITHUB_CLIENT_ID',
    'VITE_GOOGLE_CLIENT_ID',
    'VITE_DIFY_API_BASE_URL',
  ];

  const missingVars = requiredVars.filter(varName => !import.meta.env[varName]);
  
  return {
    isValid: missingVars.length === 0,
    missingVars,
  };
}

/**
 * Get build information
 */
export function getBuildInfo() {
  return {
    version: (globalThis as any).__VERSION__ || '1.0.0',
    buildTime: (globalThis as any).__BUILD_TIME__ || new Date().toISOString(),
    mode: (globalThis as any).__MODE__ || import.meta.env.MODE,
    commit: import.meta.env['VITE_GIT_COMMIT'] || 'unknown',
  };
}

/**
 * Feature flag utilities
 */
export class FeatureFlags {
  private static config = getDeploymentConfig();

  static isOptimizedComponentsEnabled(): boolean {
    return this.config.features.enableOptimizedComponents;
  }

  static isRoutePreloadingEnabled(): boolean {
    return this.config.features.enableRoutePreloading;
  }

  static isServiceWorkerEnabled(): boolean {
    return this.config.features.enableServiceWorker;
  }

  static isAnalyticsEnabled(): boolean {
    return this.config.monitoring.enableAnalytics;
  }

  static isErrorTrackingEnabled(): boolean {
    return this.config.monitoring.enableErrorTracking;
  }

  static isPerformanceMonitoringEnabled(): boolean {
    return this.config.monitoring.enablePerformanceMonitoring;
  }
}