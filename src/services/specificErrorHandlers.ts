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
    const config = DEFAULT_RETRY_CONFIGS.authentication;
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
      throw createAuthenticationError(
        'Authentication session expired. Please log in again.',
        {
          provider: error.provider,
          authStep: 'refresh',
          severity: ErrorSeverity.HIGH,
          code: 'AUTH_SESSION_EXPIRED',
        }
      );
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
    throw createAuthenticationError(
      `Authentication callback failed. This may be due to an invalid or expired authorization code. Please try logging in again.`,
      {
        provider: error.provider,
        authStep: 'callback',
        severity: ErrorSeverity.HIGH,
        code: 'AUTH_CALLBACK_FAILED',
        details: {
          originalError: error.message,
          suggestion: 'Clear browser cache and cookies, then try logging in again',
        },
      }
    );
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

    // Create detailed error message based on context
    const resourceName = this.getResourceDisplayName(error.resource || context?.resource);
    const actionName = this.getActionDisplayName(error.action || context?.action);
    
    let message = 'You do not have permission to access this resource.';
    let suggestions: string[] = [];

    // Provide specific messaging based on resource and action
    if (resourceName && actionName) {
      message = `You do not have permission to ${actionName} ${resourceName}.`;
      
      // Add specific suggestions based on the resource type
      switch (error.resource || context?.resource) {
        case 'workflow':
          suggestions = [
            'Contact your administrator to request workflow access',
            'Verify your email domain is authorized for this service',
            'Check if you need to be added to a specific team or role',
          ];
          break;
        
        case 'admin':
          suggestions = [
            'Administrative access is restricted to authorized personnel',
            'Contact your system administrator if you believe you should have access',
          ];
          break;
        
        default:
          suggestions = [
            'Contact your administrator to request access',
            'Verify you are logged in with the correct account',
          ];
      }
    }

    // Include required permissions if available
    const requiredPermissions = error.requiredPermissions || [];
    if (requiredPermissions.length > 0) {
      suggestions.unshift(`Required permissions: ${requiredPermissions.join(', ')}`);
    }

    // Include user's current permissions for debugging (development only)
    let debugInfo: any = undefined;
    if (process.env.NODE_ENV === 'development' && context?.userPermissions) {
      debugInfo = {
        userPermissions: context.userPermissions,
        requiredPermissions,
        resource: error.resource || context?.resource,
        action: error.action || context?.action,
      };
    }

    throw createAuthorizationError(message, {
      resource: error.resource || context?.resource,
      action: error.action || context?.action,
      requiredPermissions,
      severity: ErrorSeverity.HIGH,
      code: 'AUTHZ_ACCESS_DENIED',
      details: {
        suggestions,
        debugInfo,
        originalError: error.message,
      },
    });
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
    const config = DEFAULT_RETRY_CONFIGS.network;
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
  private static createUserFriendlyNetworkError(error: NetworkError, retryCount: number): NetworkError {
    let message = 'Network error occurred. Please check your connection and try again.';
    let code = 'NETWORK_GENERIC_ERROR';
    let severity = ErrorSeverity.MEDIUM;
    let suggestions: string[] = [];

    switch (error.status) {
      case 400:
        message = 'Invalid request. Please check your input and try again.';
        code = 'NETWORK_BAD_REQUEST';
        severity = ErrorSeverity.LOW;
        suggestions = ['Verify all required fields are filled correctly'];
        break;
      
      case 401:
        message = 'Authentication required. Please log in and try again.';
        code = 'NETWORK_UNAUTHORIZED';
        severity = ErrorSeverity.HIGH;
        suggestions = ['Try logging out and logging back in'];
        break;
      
      case 403:
        message = 'Access forbidden. You do not have permission to perform this action.';
        code = 'NETWORK_FORBIDDEN';
        severity = ErrorSeverity.HIGH;
        suggestions = ['Contact your administrator for access'];
        break;
      
      case 404:
        message = 'The requested resource was not found.';
        code = 'NETWORK_NOT_FOUND';
        severity = ErrorSeverity.MEDIUM;
        suggestions = ['Verify the URL is correct', 'The resource may have been moved or deleted'];
        break;
      
      case 408:
        message = 'Request timeout. The server took too long to respond.';
        code = 'NETWORK_TIMEOUT';
        suggestions = ['Check your internet connection', 'Try again in a moment'];
        break;
      
      case 429:
        message = 'Too many requests. Please wait a moment and try again.';
        code = 'NETWORK_RATE_LIMITED';
        suggestions = ['Wait a few minutes before trying again'];
        break;
      
      case 500:
        message = 'Server error occurred. Please try again later.';
        code = 'NETWORK_SERVER_ERROR';
        severity = ErrorSeverity.HIGH;
        suggestions = ['Try again in a few minutes', 'Contact support if the problem persists'];
        break;
      
      case 502:
      case 503:
      case 504:
        message = 'Service temporarily unavailable. Please try again later.';
        code = 'NETWORK_SERVICE_UNAVAILABLE';
        severity = ErrorSeverity.HIGH;
        suggestions = ['The service may be under maintenance', 'Try again in a few minutes'];
        break;
      
      default:
        if (!error.status) {
          message = 'Unable to connect to the server. Please check your internet connection.';
          code = 'NETWORK_CONNECTION_ERROR';
          suggestions = [
            'Check your internet connection',
            'Verify you are not behind a firewall blocking the connection',
            'Try refreshing the page',
          ];
        }
    }

    return createNetworkError(message, {
      status: error.status,
      statusText: error.statusText,
      endpoint: error.endpoint,
      method: error.method,
      severity,
      code,
      retryCount,
      details: {
        suggestions,
        originalError: error.message,
      },
    });
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
    const config = DEFAULT_RETRY_CONFIGS.difyApi;
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
  ): DifyApiError {
    const workflowName = context?.workflowName || `Workflow ${error.workflowId || context?.workflowId || 'Unknown'}`;
    let message = `${workflowName} execution failed. Please try again.`;
    let code = 'DIFY_GENERIC_ERROR';
    let severity = ErrorSeverity.MEDIUM;
    let suggestions: string[] = [];

    // Provide specific messaging based on API error code
    switch (error.apiErrorCode) {
      case 'WORKFLOW_NOT_FOUND':
        message = `${workflowName} was not found or is no longer available.`;
        code = 'DIFY_WORKFLOW_NOT_FOUND';
        severity = ErrorSeverity.HIGH;
        suggestions = [
          'Verify the workflow still exists',
          'Contact your administrator if the workflow was recently removed',
        ];
        break;
      
      case 'INVALID_INPUT':
        message = `Invalid input provided to ${workflowName}. Please check your data and try again.`;
        code = 'DIFY_INVALID_INPUT';
        severity = ErrorSeverity.LOW;
        suggestions = [
          'Verify all required fields are filled correctly',
          'Check that input values match the expected format',
          'Review the workflow documentation for input requirements',
        ];
        break;
      
      case 'WORKFLOW_BUSY':
        message = `${workflowName} is currently busy processing other requests. Please try again in a moment.`;
        code = 'DIFY_WORKFLOW_BUSY';
        suggestions = [
          'Wait a few seconds and try again',
          'The workflow may be processing a large number of requests',
        ];
        break;
      
      case 'RATE_LIMITED':
        message = `Too many requests to ${workflowName}. Please wait before trying again.`;
        code = 'DIFY_RATE_LIMITED';
        suggestions = [
          'Wait a few minutes before submitting another request',
          'Consider reducing the frequency of your requests',
        ];
        break;
      
      case 'EXECUTION_FAILED':
        message = `${workflowName} execution failed due to an internal error.`;
        code = 'DIFY_EXECUTION_FAILED';
        severity = ErrorSeverity.HIGH;
        suggestions = [
          'Try again with different input values',
          'Contact support if the problem persists',
          'Check if the workflow configuration is correct',
        ];
        break;
      
      case 'TIMEOUT':
        message = `${workflowName} execution timed out. The workflow may be taking longer than expected.`;
        code = 'DIFY_TIMEOUT';
        suggestions = [
          'Try again - the workflow may complete faster on retry',
          'Consider simplifying your input if possible',
          'Contact support if timeouts persist',
        ];
        break;
      
      case 'INSUFFICIENT_RESOURCES':
        message = `${workflowName} cannot be executed due to insufficient system resources.`;
        code = 'DIFY_INSUFFICIENT_RESOURCES';
        severity = ErrorSeverity.HIGH;
        suggestions = [
          'Try again later when system load is lower',
          'Contact your administrator about resource limits',
        ];
        break;
      
      case 'PERMISSION_DENIED':
        message = `You do not have permission to execute ${workflowName}.`;
        code = 'DIFY_PERMISSION_DENIED';
        severity = ErrorSeverity.HIGH;
        suggestions = [
          'Contact your administrator to request access to this workflow',
          'Verify you are logged in with the correct account',
        ];
        break;
      
      default:
        // Handle based on HTTP status if available
        if (error.message.includes('404')) {
          message = `${workflowName} endpoint was not found.`;
          code = 'DIFY_ENDPOINT_NOT_FOUND';
          suggestions = [
            'The workflow may have been moved or deleted',
            'Contact your administrator to verify the workflow configuration',
          ];
        } else if (error.message.includes('500')) {
          message = `${workflowName} encountered a server error.`;
          code = 'DIFY_SERVER_ERROR';
          severity = ErrorSeverity.HIGH;
          suggestions = [
            'Try again in a few minutes',
            'Contact support if the error persists',
          ];
        } else if (error.message.includes('503')) {
          message = `${workflowName} service is temporarily unavailable.`;
          code = 'DIFY_SERVICE_UNAVAILABLE';
          severity = ErrorSeverity.HIGH;
          suggestions = [
            'The service may be under maintenance',
            'Try again in a few minutes',
          ];
        }
    }

    // Add execution-specific context if available
    let executionContext: any = undefined;
    if (context?.executionId) {
      executionContext = {
        executionId: context.executionId,
        workflowId: error.workflowId || context.workflowId,
        workflowName,
      };
    }

    return createDifyApiError(message, {
      workflowId: error.workflowId || context?.workflowId,
      executionId: error.executionId || context?.executionId,
      apiEndpoint: error.apiEndpoint,
      apiErrorCode: error.apiErrorCode,
      severity,
      code,
      details: {
        suggestions,
        executionContext,
        retryCount,
        originalError: error.message,
      },
    });
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