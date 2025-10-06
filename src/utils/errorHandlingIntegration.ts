/**
 * Error Handling Integration Utilities
 * Provides utilities to integrate the new error handling with existing services
 */

import {
  AppError,
  ErrorType,
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
import {
  handleAuthenticationError,
  handleAuthorizationError,
  handleNetworkError,
  handleDifyApiError,
} from '../services/specificErrorHandlers';

/**
 * Wrapper for fetch requests with automatic error handling
 */
export async function fetchWithErrorHandling(
  url: string,
  options: RequestInit = {},
  context?: {
    endpoint?: string;
    retryOperation?: () => Promise<Response>;
  }
): Promise<Response> {
  const operation = context?.retryOperation || (() => fetch(url, options));

  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const networkError = createNetworkError(
        `HTTP ${response.status}: ${response.statusText}`,
        {
          status: response.status,
          statusText: response.statusText,
          endpoint: context?.endpoint || url,
          method: options.method || 'GET',
        }
      );

      // Handle the network error with retry logic
      return await handleNetworkError(networkError, operation, {
        endpoint: context?.endpoint || url,
        method: options.method || 'GET',
      });
    }

    return response;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      // Network connectivity error
      const networkError = createNetworkError(
        'Unable to connect to the server. Please check your internet connection.',
        {
          endpoint: context?.endpoint || url,
          method: options.method || 'GET',
        }
      );

      return await handleNetworkError(networkError, operation, {
        endpoint: context?.endpoint || url,
        method: options.method || 'GET',
      });
    }

    throw error;
  }
}

/**
 * Wrapper for authentication operations with automatic error handling
 */
export async function authOperationWithErrorHandling<T>(
  operation: () => Promise<T>,
  context: {
    provider?: string;
    authStep?: 'login' | 'callback' | 'refresh' | 'logout';
  }
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isAuthenticationError(error)) {
      const authError = error as AuthenticationError;
      return await handleAuthenticationError(authError, operation, context);
    }

    // Convert generic errors to authentication errors
    const authError = createAuthenticationError(
      error instanceof Error ? error.message : 'Authentication operation failed',
      {
        provider: context.provider,
        authStep: context.authStep,
      }
    );

    return await handleAuthenticationError(authError, operation, context);
  }
}

/**
 * Wrapper for authorization checks with automatic error handling
 */
export async function authorizationCheckWithErrorHandling(
  checkFunction: () => boolean | Promise<boolean>,
  context: {
    resource?: string;
    action?: string;
    routeName?: string;
    userPermissions?: string[];
  }
): Promise<boolean> {
  try {
    const hasPermission = await checkFunction();
    
    if (!hasPermission) {
      const authzError = createAuthorizationError(
        `Access denied to ${context.resource || 'resource'}`,
        {
          resource: context.resource,
          action: context.action,
        }
      );

      await handleAuthorizationError(authzError, context);
    }

    return hasPermission;
  } catch (error) {
    if (isAuthorizationError(error)) {
      await handleAuthorizationError(error as AuthorizationError, context);
      return false;
    }

    // Convert generic errors to authorization errors
    const authzError = createAuthorizationError(
      error instanceof Error ? error.message : 'Authorization check failed',
      {
        resource: context.resource,
        action: context.action,
      }
    );

    await handleAuthorizationError(authzError, context);
    return false;
  }
}

/**
 * Wrapper for Dify API operations with automatic error handling
 */
export async function difyApiOperationWithErrorHandling<T>(
  operation: () => Promise<T>,
  context: {
    workflowId?: string;
    workflowName?: string;
    executionId?: string;
    apiEndpoint?: string;
  }
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isDifyApiError(error)) {
      const difyError = error as DifyApiError;
      return await handleDifyApiError(difyError, operation, context);
    }

    // Convert generic errors to Dify API errors
    let apiErrorCode: string | undefined;
    let message = error instanceof Error ? error.message : 'Dify API operation failed';

    // Try to extract error code from error message or response
    if (error instanceof Error) {
      if (error.message.includes('404')) {
        apiErrorCode = 'WORKFLOW_NOT_FOUND';
        message = `Workflow not found: ${context.workflowName || context.workflowId}`;
      } else if (error.message.includes('400')) {
        apiErrorCode = 'INVALID_INPUT';
        message = 'Invalid input provided to workflow';
      } else if (error.message.includes('429')) {
        apiErrorCode = 'RATE_LIMITED';
        message = 'Too many requests to workflow API';
      } else if (error.message.includes('500')) {
        apiErrorCode = 'EXECUTION_FAILED';
        message = 'Workflow execution failed due to server error';
      } else if (error.message.includes('timeout')) {
        apiErrorCode = 'TIMEOUT';
        message = 'Workflow execution timed out';
      }
    }

    const difyError = createDifyApiError(message, {
      workflowId: context.workflowId,
      executionId: context.executionId,
      apiEndpoint: context.apiEndpoint,
      apiErrorCode,
    });

    return await handleDifyApiError(difyError, operation, context);
  }
}

/**
 * Higher-order function to wrap any async function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  asyncFunction: T,
  errorContext?: {
    type?: ErrorType;
    context?: any;
  }
): T {
  return (async (...args: any[]) => {
    try {
      return await asyncFunction(...args);
    } catch (error) {
      // Handle based on error type or context
      if (errorContext?.type) {
        switch (errorContext.type) {
          case ErrorType.AUTHENTICATION_ERROR:
            return await authOperationWithErrorHandling(
              () => asyncFunction(...args),
              errorContext.context || {}
            );
          
          case ErrorType.NETWORK_ERROR:
            const networkError = createNetworkError(
              error instanceof Error ? error.message : 'Network operation failed'
            );
            return await handleNetworkError(
              networkError,
              () => asyncFunction(...args),
              errorContext.context
            );
          
          case ErrorType.DIFY_API_ERROR:
            return await difyApiOperationWithErrorHandling(
              () => asyncFunction(...args),
              errorContext.context || {}
            );
        }
      }

      throw error;
    }
  }) as T;
}

/**
 * Decorator for class methods to add error handling
 */
export function withMethodErrorHandling(
  errorType: ErrorType,
  context?: any
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        switch (errorType) {
          case ErrorType.AUTHENTICATION_ERROR:
            return await authOperationWithErrorHandling(
              () => originalMethod.apply(this, args),
              context || {}
            );
          
          case ErrorType.NETWORK_ERROR:
            const networkError = createNetworkError(
              error instanceof Error ? error.message : 'Network operation failed'
            );
            return await handleNetworkError(
              networkError,
              () => originalMethod.apply(this, args),
              context
            );
          
          case ErrorType.DIFY_API_ERROR:
            return await difyApiOperationWithErrorHandling(
              () => originalMethod.apply(this, args),
              context || {}
            );
          
          default:
            throw error;
        }
      }
    };

    return descriptor;
  };
}

/**
 * Utility to create error-handled versions of existing service methods
 */
export function createErrorHandledService<T extends Record<string, any>>(
  service: T,
  errorMappings: Record<keyof T, {
    type: ErrorType;
    context?: any;
  }>
): T {
  const errorHandledService = {} as T;

  for (const [methodName, method] of Object.entries(service)) {
    if (typeof method === 'function') {
      const errorMapping = errorMappings[methodName as keyof T];
      
      if (errorMapping) {
        errorHandledService[methodName as keyof T] = withErrorHandling(
          method.bind(service),
          errorMapping
        );
      } else {
        errorHandledService[methodName as keyof T] = method.bind(service);
      }
    } else {
      errorHandledService[methodName as keyof T] = method;
    }
  }

  return errorHandledService;
}

/**
 * React hook wrapper for error handling
 */
export function useErrorHandledCallback<T extends (...args: any[]) => Promise<any>>(
  callback: T,
  errorType: ErrorType,
  context?: any
): T {
  return withErrorHandling(callback, { type: errorType, context }) as T;
}

/**
 * Promise wrapper with error handling
 */
export async function withPromiseErrorHandling<T>(
  promise: Promise<T>,
  errorType: ErrorType,
  context?: any
): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    switch (errorType) {
      case ErrorType.AUTHENTICATION_ERROR:
        return await authOperationWithErrorHandling(
          () => promise,
          context || {}
        );
      
      case ErrorType.NETWORK_ERROR:
        const networkError = createNetworkError(
          error instanceof Error ? error.message : 'Network operation failed'
        );
        return await handleNetworkError(
          networkError,
          () => promise,
          context
        );
      
      case ErrorType.DIFY_API_ERROR:
        return await difyApiOperationWithErrorHandling(
          () => promise,
          context || {}
        );
      
      default:
        throw error;
    }
  }
}

// Type guards

function isAuthenticationError(error: any): error is AuthenticationError {
  return error && error.type === ErrorType.AUTHENTICATION_ERROR;
}

function isAuthorizationError(error: any): error is AuthorizationError {
  return error && error.type === ErrorType.AUTHORIZATION_ERROR;
}

function isNetworkError(error: any): error is NetworkError {
  return error && error.type === ErrorType.NETWORK_ERROR;
}

function isDifyApiError(error: any): error is DifyApiError {
  return error && error.type === ErrorType.DIFY_API_ERROR;
}

// Export type guards for external use
export {
  isAuthenticationError,
  isAuthorizationError,
  isNetworkError,
  isDifyApiError,
};