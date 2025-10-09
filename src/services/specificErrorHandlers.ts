/**
 * Specific Error Handling Scenarios
 * Implements task 7.2: Add authentication, authorization, network, and Dify API error handling
 * with automatic retry mechanisms and clear messaging
 */

import {
  AppError,
  ErrorType,
  ErrorSeverity,
  AuthenticationError,
  AuthorizationError,
  NetworkError,
  DifyApiError,
} from '../types/error';
import {
  createAuthenticationError,
  createAuthorizationError,
  createNetworkError,
  createDifyApiError,
} from '../utils/errorUtils';
import { logError } from '../services/errorLoggingService';
import { TokenRefreshService } from './tokenRefresh';
import { TokenManager } from './tokenManager';

/**
 * Retry configuration for different error types
 */
interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableStatuses?: number[];
}

/**
 * Default retry configurations
 */
const DEFAULT_RETRY_CONFIGS: Record<string, RetryConfig> = {
  authentication: {
    maxAttempts: 2,
    baseDelay: 1000,
    maxDelay: 5000,
    backoffMultiplier: 2,
  },
  network: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    retryableStatuses: [408, 429, 500, 502, 503, 504],
  },
  difyApi: {
    maxAttempts: 3,
    baseDelay: 2000,
    maxDelay: 15000,
    backoffMultiplier: 2,
    retryableStatuses: [408, 429, 500, 502, 503, 504],
  },
};

/**
 * Authentication Error Handler
 * Handles authentication failures with automatic retry and token refresh
 */
export class AuthenticationErrorHandler {
  private static retryCount = new Map<string, number>();

  /**
   * Handle authentication error with automatic retry
   */
  static async handleAuthenticationError(
    error: AuthenticationError,
    operation: () => Promise<any>,
    context?: { provider?: string; authStep?: string }
  ): Promise<any> {
    const config = DEFAULT_RETRY_CONFIGS['authentication'];
    const errorKey = `${error.provider || 'unknown'}-${error.authStep || 'unknown'}`;
    const currentRetryCount = this.retryCount.get(errorKey) || 0;

    // Log the authentication error
    await logError(error, {
      errorId: `auth-error-${Date.now()}`,
      timestamp: new Date(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      routeName: context?.authStep,
    });

    // Handle specific authentication error types
    switch (error.authStep) {
      case 'refresh':
        return this.handleTokenRefreshError(error, operation, currentRetryCount, config);
      
      case 'login':
        return this.handleLoginError(error, operation, currentRetryCount, config);
      
      case 'callback':
        return this.handleCallbackError(error, operation, currentRetryCount, config);
      
      default:
        return this.handleGenericAuthError(error, operation, currentRetryCount, config);
    }
  }

  /**
   * Handle token refresh errors with automatic retry
   */
  private static async handleTokenRefreshError(
    error: AuthenticationError,
    operation: () => Promise<any>,
    retryCount: number,
    config: RetryConfig
  ): Promise<any> {
    if (retryCount >= config.maxAttempts) {
      // Max retries reached - force logout
      TokenManager.clearSession();
      throw new Error('Authentication session expired');
    }

    // Wait before retry with exponential backoff
    const delay = Math.min(
      config.baseDelay * Math.pow(config.backoffMultiplier, retryCount),
      config.maxDelay
    );
    await this.sleep(delay);

    // Increment retry count
    const errorKey = `${error.provider || 'unknown'}-refresh`;
    this.retryCount.set(errorKey, retryCount + 1);

    try {
      // Attempt token refresh
      const refreshedSession = await TokenRefreshService.refreshAccessToken();
      if (refreshedSession) {
        // Reset retry count on success
        this.retryCount.delete(errorKey);
        // Retry the original operation
        return await operation();
      } else {
        throw error;
      }
    } catch (refreshError) {
      // If refresh fails, try the operation again (it might handle the error differently)
      return this.handleTokenRefreshError(error, operation, retryCount + 1, config);
    }
  }

  /**
   * Handle login errors with user-friendly messaging
   */
  private static async handleLoginError(
    error: AuthenticationError,
    operation: () => Promise<any>,
    retryCount: number,
    config: RetryConfig
  ): Promise<any> {
    if (retryCount >= config.maxAttempts) {
      throw createAuthenticationError(
        `Login failed with ${error.provider || 'authentication provider'}. Please check your credentials and try again.`,
        {
          provider: error.provider,
          authStep: 'login',
          severity: ErrorSeverity.HIGH,
          code: 'AUTH_LOGIN_FAILED',
          details: {
            originalError: error.message,
            retryCount,
          },
        }
      );
    }

    // Wait before retry
    const delay = Math.min(
      config.baseDelay * Math.pow(config.backoffMultiplier, retryCount),
      config.maxDelay
    );
    await this.sleep(delay);

    // Increment retry count
    const errorKey = `${error.provider || 'unknown'}-login`;
    this.retryCount.set(errorKey, retryCount + 1);

    // Retry the operation
    try {
      const result = await operation();
      this.retryCount.delete(errorKey);
      return result;
    } catch (retryError) {
      return this.handleLoginError(error, operation, retryCount + 1, config);
    }
  }

  /**
   * Handle OAuth callback errors
   */
  private static async handleCallbackError(
    error: AuthenticationError,
    operation: () => Promise<any>,
    retryCount: number,
    config: RetryConfig
  ): Promise<any> {
    // Callback errors are usually not retryable - provide clear messaging
    throw new Error('Authentication callback failed');
  }

  /**
   * Handle generic authentication errors
   */
  private static async handleGenericAuthError(
    error: AuthenticationError,
    operation: () => Promise<any>,
    retryCount: number,
    config: RetryConfig
  ): Promise<any> {
    if (retryCount >= config.maxAttempts) {
      throw createAuthenticationError(
        'Authentication failed. Please try logging in again.',
        {
          provider: error.provider,
          severity: ErrorSeverity.HIGH,
          code: 'AUTH_GENERIC_FAILED',
          details: {
            originalError: error.message,
            retryCount,
          },
        }
      );
    }

    // Wait before retry
    const delay = Math.min(
      config.baseDelay * Math.pow(config.backoffMultiplier, retryCount),
      config.maxDelay
    );
    await this.sleep(delay);

    // Increment retry count
    const errorKey = `${error.provider || 'unknown'}-generic`;
    this.retryCount.set(errorKey, retryCount + 1);

    // Retry the operation
    try {
      const result = await operation();
      this.retryCount.delete(errorKey);
      return result;
    } catch (retryError) {
      return this.handleGenericAuthError(error, operation, retryCount + 1, config);
    }
  }

  /**
   * Clear retry counts (useful for testing or manual reset)
   */
  static clearRetryCount(): void {
    this.retryCount.clear();
  }

  /**
   * Sleep utility for delays
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Authorization Error Handler
 * Handles authorization failures with clear messaging and appropriate actions
 */
export class AuthorizationErrorHandler {
  /**
   * Handle authorization error with clear messaging
   */
  static async handleAuthorizationError(
    error: AuthorizationError,
    context?: { 
      resource?: string; 
      action?: string; 
      routeName?: string;
      userPermissions?: string[];
    }
  ): Promise<never> {
    // Log the authorization error
    await logError(error, {
      errorId: `authz-error-${Date.now()}`,
      timestamp: new Date(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      routeName: context?.routeName,
    });

    // Create specific error messages based on resource and action
    const resource = error.resource || context?.resource;
    const action = error.action || context?.action;
    
    let message = 'You do not have permission to access this resource.';

    // Provide specific messaging based on resource and action
    if (resource === 'workflow' && action === 'execute') {
      message = 'You do not have permission to execute workflows';
    } else if (resource === 'admin' && action === 'access') {
      message = 'You do not have permission to access administrative features';
    }

    throw new Error(message);
  }

  /**
   * Get user-friendly resource display name
   */
  private static getResourceDisplayName(resource?: string): string {
    switch (resource) {
      case 'workflow':
        return 'workflows';
      case 'admin':
        return 'administrative features';
      case 'user':
        return 'user data';
      case 'report':
        return 'reports';
      default:
        return resource || 'this resource';
    }
  }

  /**
   * Get user-friendly action display name
   */
  private static getActionDisplayName(action?: string): string {
    switch (action) {
      case 'read':
        return 'view';
      case 'write':
      case 'create':
        return 'create';
      case 'update':
        return 'modify';
      case 'delete':
        return 'delete';
      case 'execute':
        return 'execute';
      case 'manage':
        return 'manage';
      default:
        return action || 'access';
    }
  }
}

/**
 * Network Error Handler
 * Handles network failures with retry mechanisms and user-friendly messaging
 */
export class NetworkErrorHandler {
  private static retryCount = new Map<string, number>();

  /**
   * Handle network error with automatic retry
   */
  static async handleNetworkError(
    error: NetworkError,
    operation: () => Promise<any>,
    context?: { endpoint?: string; method?: string }
  ): Promise<any> {
    const config = DEFAULT_RETRY_CONFIGS['network'];
    const errorKey = `${error.endpoint || context?.endpoint || 'unknown'}-${error.method || context?.method || 'unknown'}`;
    const currentRetryCount = this.retryCount.get(errorKey) || 0;

    // Log the network error
    await logError(error, {
      errorId: `network-error-${Date.now()}`,
      timestamp: new Date(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    });

    // Check if error is retryable
    if (!this.isRetryableNetworkError(error, config)) {
      throw this.createUserFriendlyNetworkError(error, currentRetryCount);
    }

    // Check retry limit
    if (currentRetryCount >= config.maxAttempts) {
      throw this.createUserFriendlyNetworkError(error, currentRetryCount);
    }

    // Handle rate limiting with special delay
    if (error.status === 429) {
      return this.handleRateLimitError(error, operation, currentRetryCount, config, errorKey);
    }

    // Wait before retry with exponential backoff
    const delay = Math.min(
      config.baseDelay * Math.pow(config.backoffMultiplier, currentRetryCount),
      config.maxDelay
    );
    await this.sleep(delay);

    // Increment retry count
    this.retryCount.set(errorKey, currentRetryCount + 1);

    try {
      const result = await operation();
      // Reset retry count on success
      this.retryCount.delete(errorKey);
      return result;
    } catch (retryError) {
      // If it's still a network error, continue retrying
      if (retryError instanceof Error && this.isNetworkError(retryError)) {
        const networkRetryError = retryError as unknown as NetworkError;
        return this.handleNetworkError(networkRetryError, operation, context);
      }
      // If it's a different type of error, throw it
      throw retryError;
    }
  }

  /**
   * Handle rate limiting errors with appropriate delays
   */
  private static async handleRateLimitError(
    error: NetworkError,
    operation: () => Promise<any>,
    retryCount: number,
    config: RetryConfig,
    errorKey: string
  ): Promise<any> {
    // For rate limiting, use a longer delay
    const rateLimitDelay = 5000 + (retryCount * 2000); // 5s, 7s, 9s, etc.
    await this.sleep(rateLimitDelay);

    // Increment retry count
    this.retryCount.set(errorKey, retryCount + 1);

    try {
      const result = await operation();
      this.retryCount.delete(errorKey);
      return result;
    } catch (retryError) {
      if (retryCount + 1 >= config.maxAttempts) {
        throw createNetworkError(
          'Service is currently experiencing high traffic. Please try again in a few minutes.',
          {
            status: 429,
            endpoint: error.endpoint,
            method: error.method,
            severity: ErrorSeverity.MEDIUM,
            code: 'NETWORK_RATE_LIMITED',
            retryCount: retryCount + 1,
          }
        );
      }
      return this.handleRateLimitError(error, operation, retryCount + 1, config, errorKey);
    }
  }

  /**
   * Check if network error is retryable
   */
  private static isRetryableNetworkError(error: NetworkError, config: RetryConfig): boolean {
    // No status code means network connectivity issue - retryable
    if (!error.status) {
      return true;
    }

    // Check against retryable status codes
    return config.retryableStatuses?.includes(error.status) || false;
  }

  /**
   * Create user-friendly network error
   */
  private static createUserFriendlyNetworkError(error: NetworkError, retryCount: number): Error {
    let message = 'Network error occurred. Please check your connection and try again.';

    switch (error.status) {
      case 400:
        message = 'Invalid request';
        break;
      case 404:
        message = 'The requested resource was not found';
        break;
      default:
        if (!error.status) {
          message = 'Network error';
        }
    }

    return new Error(message);
  }

  /**
   * Check if error is a network error
   */
  private static isNetworkError(error: Error): boolean {
    return error.name === 'NetworkError' || 
           error.message.includes('fetch') ||
           error.message.includes('network') ||
           error.message.includes('connection');
  }

  /**
   * Clear retry counts
   */
  static clearRetryCount(): void {
    this.retryCount.clear();
  }

  /**
   * Sleep utility for delays
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Dify API Error Handler
 * Handles Dify workflow API errors with workflow-specific messaging and retry logic
 */
export class DifyApiErrorHandler {
  private static retryCount = new Map<string, number>();

  /**
   * Handle Dify API error with workflow-specific messaging and retry
   */
  static async handleDifyApiError(
    error: DifyApiError,
    operation: () => Promise<any>,
    context?: { 
      workflowId?: string; 
      workflowName?: string;
      executionId?: string;
    }
  ): Promise<any> {
    const config = DEFAULT_RETRY_CONFIGS['difyApi'];
    const errorKey = `${error.workflowId || context?.workflowId || 'unknown'}-${error.apiEndpoint || 'unknown'}`;
    const currentRetryCount = this.retryCount.get(errorKey) || 0;

    // Log the Dify API error
    await logError(error, {
      errorId: `dify-error-${Date.now()}`,
      timestamp: new Date(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    });

    // Check if error is retryable
    if (!this.isRetryableDifyError(error)) {
      throw this.createUserFriendlyDifyError(error, context, currentRetryCount);
    }

    // Check retry limit
    if (currentRetryCount >= config.maxAttempts) {
      throw this.createUserFriendlyDifyError(error, context, currentRetryCount);
    }

    // Wait before retry with exponential backoff
    const delay = Math.min(
      config.baseDelay * Math.pow(config.backoffMultiplier, currentRetryCount),
      config.maxDelay
    );
    await this.sleep(delay);

    // Increment retry count
    this.retryCount.set(errorKey, currentRetryCount + 1);

    try {
      const result = await operation();
      // Reset retry count on success
      this.retryCount.delete(errorKey);
      return result;
    } catch (retryError) {
      // If it's still a Dify API error, continue retrying
      if (this.isDifyApiError(retryError)) {
        const difyRetryError = retryError as unknown as DifyApiError;
        return this.handleDifyApiError(difyRetryError, operation, context);
      }
      // If it's a different type of error, throw it
      throw retryError;
    }
  }

  /**
   * Check if Dify API error is retryable
   */
  private static isRetryableDifyError(error: DifyApiError): boolean {
    // Check API error codes that are retryable
    const retryableCodes = [
      'WORKFLOW_BUSY',
      'RATE_LIMITED',
      'TEMPORARY_FAILURE',
      'TIMEOUT',
      'SERVICE_UNAVAILABLE',
    ];

    return retryableCodes.includes(error.apiErrorCode || '') ||
           error.message.includes('timeout') ||
           error.message.includes('busy') ||
           error.message.includes('unavailable');
  }

  /**
   * Create user-friendly Dify API error with workflow-specific messaging
   */
  private static createUserFriendlyDifyError(
    error: DifyApiError,
    context?: { 
      workflowId?: string; 
      workflowName?: string;
      executionId?: string;
    },
    retryCount?: number
  ): Error {
    const workflowName = context?.workflowName || `Workflow ${error.workflowId || context?.workflowId || 'Unknown'}`;
    let message = `${workflowName} execution failed. Please try again.`;

    // Provide specific messaging based on API error code
    switch (error.apiErrorCode) {
      case 'WORKFLOW_NOT_FOUND':
        message = `${workflowName} was not found or is no longer available`;
        break;
      
      case 'INVALID_INPUT':
        message = `Invalid input provided to ${workflowName}`;
        break;
      
      case 'EXECUTION_FAILED':
        message = `${workflowName} execution failed due to an internal error`;
        break;
    }

    return new Error(message);
  }


  /**
   * Check if error is a Dify API error
   */
  private static isDifyApiError(error: any): boolean {
    return error.type === ErrorType.DIFY_API_ERROR ||
           error.apiErrorCode ||
           error.workflowId ||
           error.executionId;
  }

  /**
   * Clear retry counts
   */
  static clearRetryCount(): void {
    this.retryCount.clear();
  }

  /**
   * Sleep utility for delays
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Unified Error Handler
 * Main entry point for handling all types of errors with appropriate strategies
 */
export class UnifiedErrorHandler {
  /**
   * Handle any error with appropriate strategy based on error type
   */
  static async handleError(
    error: AppError,
    operation: () => Promise<any>,
    context?: any
  ): Promise<any> {
    switch (error.type) {
      case ErrorType.AUTHENTICATION_ERROR:
        return AuthenticationErrorHandler.handleAuthenticationError(
          error as AuthenticationError,
          operation,
          context
        );
      
      case ErrorType.AUTHORIZATION_ERROR:
        return AuthorizationErrorHandler.handleAuthorizationError(
          error as AuthorizationError,
          context
        );
      
      case ErrorType.NETWORK_ERROR:
        return NetworkErrorHandler.handleNetworkError(
          error as NetworkError,
          operation,
          context
        );
      
      case ErrorType.DIFY_API_ERROR:
        return DifyApiErrorHandler.handleDifyApiError(
          error as DifyApiError,
          operation,
          context
        );
      
      default:
        // For other error types, just log and re-throw
        await logError(error, {
          errorId: `generic-error-${Date.now()}`,
          timestamp: new Date(),
          url: window.location.href,
          userAgent: navigator.userAgent,
        });
        throw error;
    }
  }

  /**
   * Clear all retry counts
   */
  static clearAllRetryCounts(): void {
    AuthenticationErrorHandler.clearRetryCount();
    NetworkErrorHandler.clearRetryCount();
    DifyApiErrorHandler.clearRetryCount();
  }
}

// Export convenience functions
export const handleAuthenticationError = AuthenticationErrorHandler.handleAuthenticationError;
export const handleAuthorizationError = AuthorizationErrorHandler.handleAuthorizationError;
export const handleNetworkError = NetworkErrorHandler.handleNetworkError;
export const handleDifyApiError = DifyApiErrorHandler.handleDifyApiError;
export const handleError = UnifiedErrorHandler.handleError;