/**
 * Error Utilities for Application Error Handling
 */

import {
  AppError,
  ErrorType,
  ErrorSeverity,
  ErrorLoggingConfig,
  ErrorContext,
  AuthenticationError,
  AuthorizationError,
  NetworkError,
  ValidationError,
  DifyApiError,
  RouteError,
  ComponentError,
} from '../types/error';

/**
 * Create a standardized application error
 */
export const createError = (
  type: ErrorType,
  message: string,
  options: Partial<AppError> = {}
): AppError => {
  const baseError: AppError = {
    type,
    message,
    severity: options.severity || getDefaultSeverity(type),
    timestamp: new Date(),
    userId: getCurrentUserId(),
    sessionId: getSessionId(),
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    ...options,
  };

  return baseError;
};

/**
 * Create specific error types with proper typing
 */
export const createAuthenticationError = (
  message: string,
  options: Partial<AuthenticationError> = {}
): AuthenticationError => ({
  ...createError(ErrorType.AUTHENTICATION_ERROR, message, options),
  type: ErrorType.AUTHENTICATION_ERROR,
  provider: options.provider,
  authStep: options.authStep,
});

export const createAuthorizationError = (
  message: string,
  options: Partial<AuthorizationError> = {}
): AuthorizationError => ({
  ...createError(ErrorType.AUTHORIZATION_ERROR, message, options),
  type: ErrorType.AUTHORIZATION_ERROR,
  resource: options.resource,
  action: options.action,
  requiredPermissions: options.requiredPermissions,
});

export const createNetworkError = (
  message: string,
  options: Partial<NetworkError> = {}
): NetworkError => ({
  ...createError(ErrorType.NETWORK_ERROR, message, options),
  type: ErrorType.NETWORK_ERROR,
  status: options.status,
  statusText: options.statusText,
  endpoint: options.endpoint,
  method: options.method,
  retryCount: options.retryCount || 0,
});

export const createValidationError = (
  message: string,
  options: Partial<ValidationError> = {}
): ValidationError => ({
  ...createError(ErrorType.VALIDATION_ERROR, message, options),
  type: ErrorType.VALIDATION_ERROR,
  field: options.field,
  value: options.value,
  constraint: options.constraint,
  validationErrors: options.validationErrors,
});

export const createDifyApiError = (
  message: string,
  options: Partial<DifyApiError> = {}
): DifyApiError => ({
  ...createError(ErrorType.DIFY_API_ERROR, message, options),
  type: ErrorType.DIFY_API_ERROR,
  workflowId: options.workflowId,
  executionId: options.executionId,
  apiEndpoint: options.apiEndpoint,
  apiErrorCode: options.apiErrorCode,
});

export const createRouteError = (
  message: string,
  options: Partial<RouteError> = {}
): RouteError => ({
  ...createError(ErrorType.ROUTE_ERROR, message, options),
  type: ErrorType.ROUTE_ERROR,
  routeName: options.routeName,
  routePath: options.routePath,
  params: options.params,
});

export const createComponentError = (
  message: string,
  options: Partial<ComponentError> = {}
): ComponentError => ({
  ...createError(ErrorType.COMPONENT_ERROR, message, options),
  type: ErrorType.COMPONENT_ERROR,
  componentName: options.componentName,
  componentStack: options.componentStack,
  props: options.props,
});

/**
 * Get default severity for error type
 */
const getDefaultSeverity = (type: ErrorType): ErrorSeverity => {
  switch (type) {
    case ErrorType.AUTHENTICATION_ERROR:
      return ErrorSeverity.HIGH;
    case ErrorType.AUTHORIZATION_ERROR:
      return ErrorSeverity.HIGH;
    case ErrorType.NETWORK_ERROR:
      return ErrorSeverity.MEDIUM;
    case ErrorType.VALIDATION_ERROR:
      return ErrorSeverity.LOW;
    case ErrorType.DIFY_API_ERROR:
      return ErrorSeverity.MEDIUM;
    case ErrorType.ROUTE_ERROR:
      return ErrorSeverity.MEDIUM;
    case ErrorType.COMPONENT_ERROR:
      return ErrorSeverity.HIGH;
    case ErrorType.UNKNOWN_ERROR:
      return ErrorSeverity.MEDIUM;
    default:
      return ErrorSeverity.MEDIUM;
  }
};

/**
 * Check if an error is retryable
 */
export const isRetryableError = (error: AppError): boolean => {
  switch (error.type) {
    case ErrorType.NETWORK_ERROR:
      const networkError = error as NetworkError;
      return !networkError.status || 
             networkError.status >= 500 || 
             networkError.status === 408 || 
             networkError.status === 429;
    
    case ErrorType.DIFY_API_ERROR:
      return true; // Most API errors can be retried
    
    case ErrorType.AUTHENTICATION_ERROR:
      const authError = error as AuthenticationError;
      return authError.authStep === 'refresh'; // Only token refresh errors are retryable
    
    case ErrorType.COMPONENT_ERROR:
    case ErrorType.ROUTE_ERROR:
      return true; // Component and route errors can often be retried
    
    case ErrorType.AUTHORIZATION_ERROR:
    case ErrorType.VALIDATION_ERROR:
    case ErrorType.UNKNOWN_ERROR:
    default:
      return false;
  }
};

/**
 * Check if error should be logged based on configuration
 */
export const shouldLogError = (error: AppError, config: ErrorLoggingConfig): boolean => {
  // Check if error severity meets logging threshold
  const severityLevels = {
    [ErrorSeverity.LOW]: 1,
    [ErrorSeverity.MEDIUM]: 2,
    [ErrorSeverity.HIGH]: 3,
    [ErrorSeverity.CRITICAL]: 4,
  };

  return severityLevels[error.severity] >= severityLevels[config.logLevel];
};

/**
 * Sanitize error for logging (remove personal information)
 */
export const sanitizeError = (error: AppError, excludePersonalInfo: boolean): AppError => {
  if (!excludePersonalInfo) {
    return error;
  }

  const sanitized = { ...error };

  // Remove personal information
  delete sanitized.userId;
  delete sanitized.userAgent;
  
  // Sanitize URL to remove query parameters that might contain personal info
  if (sanitized.url) {
    try {
      const url = new URL(sanitized.url);
      sanitized.url = `${url.protocol}//${url.host}${url.pathname}`;
    } catch {
      sanitized.url = '[sanitized]';
    }
  }

  // Sanitize stack trace
  if (sanitized.stack) {
    sanitized.stack = sanitized.stack
      .split('\n')
      .map(line => line.replace(/\/Users\/[^\/]+/g, '/Users/[user]'))
      .map(line => line.replace(/\/home\/[^\/]+/g, '/home/[user]'))
      .join('\n');
  }

  // Sanitize details object
  if (sanitized.details && typeof sanitized.details === 'object') {
    sanitized.details = sanitizeObject(sanitized.details);
  }

  return sanitized;
};

/**
 * Sanitize object by removing potentially sensitive fields
 */
const sanitizeObject = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const sensitiveFields = ['password', 'token', 'secret', 'key', 'email', 'phone', 'ssn'];
  const sanitized: any = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[redacted]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

/**
 * Format error for user-friendly display
 */
export const formatErrorForDisplay = (error: AppError): string => {
  switch (error.type) {
    case ErrorType.AUTHENTICATION_ERROR:
      return 'Authentication failed. Please try logging in again.';
    
    case ErrorType.AUTHORIZATION_ERROR:
      return 'You do not have permission to access this resource.';
    
    case ErrorType.NETWORK_ERROR:
      const networkError = error as NetworkError;
      if (networkError.status === 404) {
        return 'The requested resource was not found.';
      } else if (networkError.status && networkError.status >= 500) {
        return 'Server error occurred. Please try again later.';
      } else if (networkError.status === 429) {
        return 'Too many requests. Please wait a moment and try again.';
      }
      return 'Network error occurred. Please check your connection and try again.';
    
    case ErrorType.VALIDATION_ERROR:
      const validationError = error as ValidationError;
      if (validationError.validationErrors && validationError.validationErrors.length > 0) {
        return `Validation failed: ${validationError.validationErrors.map(e => e.message).join(', ')}`;
      }
      return 'Invalid input. Please check your data and try again.';
    
    case ErrorType.DIFY_API_ERROR:
      return 'Workflow execution failed. Please try again or contact support.';
    
    case ErrorType.ROUTE_ERROR:
      return 'Page loading failed. Please try refreshing the page.';
    
    case ErrorType.COMPONENT_ERROR:
      return 'Component error occurred. Please try refreshing the page.';
    
    case ErrorType.UNKNOWN_ERROR:
    default:
      return 'An unexpected error occurred. Please try again or contact support.';
  }
};

/**
 * Get error severity
 */
export const getErrorSeverity = (error: AppError): ErrorSeverity => {
  return error.severity;
};

/**
 * Create error context
 */
export const createErrorContext = (
  errorId?: string,
  routeName?: string,
  componentStack?: string
): ErrorContext => ({
  errorId: errorId || generateErrorId(),
  timestamp: new Date(),
  url: typeof window !== 'undefined' ? window.location.href : '',
  userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : '',
  userId: getCurrentUserId(),
  sessionId: getSessionId(),
  routeName,
  componentStack,
});

/**
 * Generate unique error ID
 */
const generateErrorId = (): string => {
  return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Get current user ID from auth context or session
 */
const getCurrentUserId = (): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  
  try {
    // Try to get from session storage first
    const sessionData = sessionStorage.getItem('auth-session');
    if (sessionData) {
      const parsed = JSON.parse(sessionData);
      return parsed.user?.id;
    }
    
    // Fallback to localStorage
    const localData = localStorage.getItem('auth-session');
    if (localData) {
      const parsed = JSON.parse(localData);
      return parsed.user?.id;
    }
  } catch {
    // Ignore errors when accessing storage
  }
  
  return undefined;
};

/**
 * Get session ID
 */
const getSessionId = (): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  
  try {
    // Try to get from session storage
    const sessionData = sessionStorage.getItem('auth-session');
    if (sessionData) {
      const parsed = JSON.parse(sessionData);
      return parsed.sessionId;
    }
  } catch {
    // Ignore errors when accessing storage
  }
  
  return undefined;
};

/**
 * Convert JavaScript Error to AppError
 */
export const fromJavaScriptError = (
  jsError: Error,
  type: ErrorType = ErrorType.UNKNOWN_ERROR,
  options: Partial<AppError> = {}
): AppError => {
  return createError(type, jsError.message, {
    stack: jsError.stack,
    ...options,
  });
};

/**
 * Error utilities object
 */
export const errorUtils = {
  createError,
  createAuthenticationError,
  createAuthorizationError,
  createNetworkError,
  createValidationError,
  createDifyApiError,
  createRouteError,
  createComponentError,
  isRetryableError,
  shouldLogError,
  sanitizeError,
  formatErrorForDisplay,
  getErrorSeverity,
  createErrorContext,
  fromJavaScriptError,
};