/**
 * Enhanced Error Display Components with Specific Error Handling
 * Provides specialized error displays for different error types with retry functionality
 */

import React, { useState, useCallback } from 'react';
import {
  AppError,
  ErrorType,
  AuthenticationError,
  AuthorizationError,
  NetworkError,
  DifyApiError,
  ErrorSeverity,
} from '../types/error';
import { ErrorDisplay, CompactErrorDisplay, ErrorToast } from './ErrorDisplay';
import { useUnifiedErrorHandling } from '../hooks/useErrorHandling';

/**
 * Props for enhanced error display
 */
interface EnhancedErrorDisplayProps {
  error: AppError;
  onRetry?: () => Promise<void>;
  onDismiss?: () => void;
  context?: any;
  compact?: boolean;
  showAsToast?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Enhanced error display that provides specific handling for different error types
 */
export const EnhancedErrorDisplay: React.FC<EnhancedErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  context,
  compact = false,
  showAsToast = false,
  className,
  style,
}) => {
  const errorHandling = useUnifiedErrorHandling({
    onRetrySuccess: () => {
      if (onDismiss) {
        onDismiss();
      }
    },
  });

  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = useCallback(async () => {
    if (!onRetry) return;

    setIsRetrying(true);
    try {
      await errorHandling.handleError(error, onRetry, context);
    } catch (retryError) {
      console.error('Retry failed:', retryError);
    } finally {
      setIsRetrying(false);
    }
  }, [error, onRetry, context, errorHandling]);

  // Get error-specific display options
  const displayOptions = getErrorDisplayOptions(error);
  const actions = getErrorActions(error, handleRetry, onDismiss, isRetrying);

  if (showAsToast) {
    return (
      <ErrorToast
        error={error}
        onDismiss={onDismiss || (() => {})}
        duration={getToastDuration(error)}
      />
    );
  }

  if (compact) {
    return (
      <CompactErrorDisplay
        error={error}
        onRetry={onRetry ? handleRetry : undefined}
        onDismiss={onDismiss}
        className={className}
      />
    );
  }

  return (
    <ErrorDisplay
      error={error}
      context={{
        errorId: `enhanced-${Date.now()}`,
        timestamp: new Date(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      }}
      onRetry={onRetry ? handleRetry : undefined}
      actions={actions}
      options={displayOptions}
      className={className}
      style={style}
    />
  );
};

/**
 * Authentication Error Display
 */
export const AuthenticationErrorDisplay: React.FC<{
  error: AuthenticationError;
  onRetry?: () => Promise<void>;
  onLogin?: () => void;
  onDismiss?: () => void;
}> = ({ error, onRetry, onLogin, onDismiss }) => {
  const actions = [
    ...(onRetry ? [{
      label: 'Try Again',
      action: onRetry,
      primary: true,
      variant: 'primary' as const,
    }] : []),
    ...(onLogin ? [{
      label: 'Log In Again',
      action: onLogin,
      variant: 'secondary' as const,
    }] : []),
  ];

  const displayOptions = {
    title: getAuthErrorTitle(error),
    description: getAuthErrorDescription(error),
    icon: '🔐',
    showRetry: false, // Handled by actions
    showReload: false,
    showGoHome: false,
  };

  return (
    <ErrorDisplay
      error={error}
      context={{
        errorId: `auth-error-${Date.now()}`,
        timestamp: new Date(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      }}
      actions={actions}
      options={displayOptions}
    />
  );
};

/**
 * Authorization Error Display
 */
export const AuthorizationErrorDisplay: React.FC<{
  error: AuthorizationError;
  onGoBack?: () => void;
  onContactAdmin?: () => void;
  onDismiss?: () => void;
}> = ({ error, onGoBack, onContactAdmin, onDismiss }) => {
  const actions = [
    ...(onGoBack ? [{
      label: 'Go Back',
      action: onGoBack,
      primary: true,
      variant: 'primary' as const,
    }] : []),
    ...(onContactAdmin ? [{
      label: 'Contact Administrator',
      action: onContactAdmin,
      variant: 'secondary' as const,
    }] : []),
    {
      label: 'Go to Dashboard',
      action: () => window.location.href = '/',
      variant: 'secondary' as const,
    },
  ];

  const displayOptions = {
    title: 'Access Denied',
    description: getAuthzErrorDescription(error),
    icon: '🚫',
    showRetry: false,
    showReload: false,
    showGoHome: false,
  };

  return (
    <ErrorDisplay
      error={error}
      context={{
        errorId: `authz-error-${Date.now()}`,
        timestamp: new Date(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      }}
      actions={actions}
      options={displayOptions}
    />
  );
};

/**
 * Network Error Display
 */
export const NetworkErrorDisplay: React.FC<{
  error: NetworkError;
  onRetry?: () => Promise<void>;
  onCheckConnection?: () => void;
  onDismiss?: () => void;
}> = ({ error, onRetry, onCheckConnection, onDismiss }) => {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = useCallback(async () => {
    if (!onRetry) return;
    
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  }, [onRetry]);

  const actions = [
    ...(onRetry ? [{
      label: isRetrying ? 'Retrying...' : 'Try Again',
      action: handleRetry,
      primary: true,
      variant: 'primary' as const,
    }] : []),
    ...(onCheckConnection ? [{
      label: 'Check Connection',
      action: onCheckConnection,
      variant: 'secondary' as const,
    }] : []),
    {
      label: 'Reload Page',
      action: () => window.location.reload(),
      variant: 'secondary' as const,
    },
  ];

  const displayOptions = {
    title: getNetworkErrorTitle(error),
    description: getNetworkErrorDescription(error),
    icon: '🌐',
    showRetry: false, // Handled by actions
    showReload: false,
    showGoHome: true,
  };

  return (
    <ErrorDisplay
      error={error}
      context={{
        errorId: `network-error-${Date.now()}`,
        timestamp: new Date(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      }}
      actions={actions}
      options={displayOptions}
    />
  );
};

/**
 * Dify API Error Display
 */
export const DifyApiErrorDisplay: React.FC<{
  error: DifyApiError;
  onRetry?: () => Promise<void>;
  onViewWorkflows?: () => void;
  onContactSupport?: () => void;
  onDismiss?: () => void;
  workflowName?: string;
}> = ({ error, onRetry, onViewWorkflows, onContactSupport, onDismiss, workflowName }) => {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = useCallback(async () => {
    if (!onRetry) return;
    
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  }, [onRetry]);

  const actions = [
    ...(onRetry && isDifyErrorRetryable(error) ? [{
      label: isRetrying ? 'Retrying...' : 'Try Again',
      action: handleRetry,
      primary: true,
      variant: 'primary' as const,
    }] : []),
    ...(onViewWorkflows ? [{
      label: 'View Other Workflows',
      action: onViewWorkflows,
      variant: 'secondary' as const,
    }] : []),
    ...(onContactSupport ? [{
      label: 'Contact Support',
      action: onContactSupport,
      variant: 'secondary' as const,
    }] : []),
  ];

  const displayOptions = {
    title: getDifyErrorTitle(error, workflowName),
    description: getDifyErrorDescription(error, workflowName),
    icon: '🔧',
    showRetry: false, // Handled by actions
    showReload: false,
    showGoHome: true,
  };

  return (
    <ErrorDisplay
      error={error}
      context={{
        errorId: `dify-error-${Date.now()}`,
        timestamp: new Date(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      }}
      actions={actions}
      options={displayOptions}
    />
  );
};

/**
 * Error Notification Banner
 */
export const ErrorNotificationBanner: React.FC<{
  error: AppError;
  onRetry?: () => Promise<void>;
  onDismiss: () => void;
  position?: 'top' | 'bottom';
}> = ({ error, onRetry, onDismiss, position = 'top' }) => {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = useCallback(async () => {
    if (!onRetry) return;
    
    setIsRetrying(true);
    try {
      await onRetry();
      onDismiss();
    } catch (retryError) {
      console.error('Retry failed:', retryError);
    } finally {
      setIsRetrying(false);
    }
  }, [onRetry, onDismiss]);

  const errorColor = getErrorColor(error.severity);
  const errorIcon = getErrorIcon(error.type);

  return (
    <div
      style={{
        position: 'fixed',
        [position]: '1rem',
        left: '1rem',
        right: '1rem',
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '1rem',
        backgroundColor: 'white',
        border: `2px solid ${errorColor}`,
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        animation: position === 'top' ? 'slideInDown 0.3s ease-out' : 'slideInUp 0.3s ease-out',
      }}
    >
      <span style={{ fontSize: '1.5rem' }}>{errorIcon}</span>
      
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: '600', color: errorColor, marginBottom: '0.25rem' }}>
          {getErrorTitle(error.type)}
        </div>
        <div style={{ fontSize: '0.9rem', color: '#666' }}>
          {getErrorMessage(error)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {onRetry && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.8rem',
              backgroundColor: '#0078d4',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isRetrying ? 'not-allowed' : 'pointer',
              opacity: isRetrying ? 0.6 : 1,
            }}
          >
            {isRetrying ? 'Retrying...' : 'Retry'}
          </button>
        )}
        
        <button
          onClick={onDismiss}
          style={{
            padding: '0.5rem',
            fontSize: '1rem',
            backgroundColor: 'transparent',
            color: '#666',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
};

// Helper functions

function getErrorDisplayOptions(error: AppError) {
  switch (error.type) {
    case ErrorType.AUTHENTICATION_ERROR:
      return {
        title: getAuthErrorTitle(error as AuthenticationError),
        description: getAuthErrorDescription(error as AuthenticationError),
        icon: '🔐',
      };
    
    case ErrorType.AUTHORIZATION_ERROR:
      return {
        title: 'Access Denied',
        description: getAuthzErrorDescription(error as AuthorizationError),
        icon: '🚫',
      };
    
    case ErrorType.NETWORK_ERROR:
      return {
        title: getNetworkErrorTitle(error as NetworkError),
        description: getNetworkErrorDescription(error as NetworkError),
        icon: '🌐',
      };
    
    case ErrorType.DIFY_API_ERROR:
      return {
        title: getDifyErrorTitle(error as DifyApiError),
        description: getDifyErrorDescription(error as DifyApiError),
        icon: '🔧',
      };
    
    default:
      return {
        title: 'Error',
        description: error.message,
        icon: '❌',
      };
  }
}

function getErrorActions(
  error: AppError,
  onRetry?: () => Promise<void>,
  onDismiss?: () => void,
  isRetrying?: boolean
) {
  const actions = [];

  if (onRetry && isErrorRetryable(error)) {
    actions.push({
      label: isRetrying ? 'Retrying...' : 'Try Again',
      action: onRetry,
      primary: true,
      variant: 'primary' as const,
    });
  }

  if (onDismiss) {
    actions.push({
      label: 'Dismiss',
      action: onDismiss,
      variant: 'secondary' as const,
    });
  }

  return actions;
}

function getToastDuration(error: AppError): number {
  switch (error.severity) {
    case ErrorSeverity.LOW:
      return 3000;
    case ErrorSeverity.MEDIUM:
      return 5000;
    case ErrorSeverity.HIGH:
    case ErrorSeverity.CRITICAL:
      return 8000;
    default:
      return 5000;
  }
}

function isErrorRetryable(error: AppError): boolean {
  switch (error.type) {
    case ErrorType.AUTHENTICATION_ERROR:
      return (error as AuthenticationError).authStep === 'refresh';
    case ErrorType.NETWORK_ERROR:
      return true;
    case ErrorType.DIFY_API_ERROR:
      return isDifyErrorRetryable(error as DifyApiError);
    default:
      return false;
  }
}

function isDifyErrorRetryable(error: DifyApiError): boolean {
  const retryableCodes = [
    'WORKFLOW_BUSY',
    'RATE_LIMITED',
    'TEMPORARY_FAILURE',
    'TIMEOUT',
    'SERVICE_UNAVAILABLE',
  ];
  return retryableCodes.includes(error.apiErrorCode || '');
}

// Error message helpers

function getAuthErrorTitle(error: AuthenticationError): string {
  switch (error.authStep) {
    case 'login':
      return 'Login Failed';
    case 'callback':
      return 'Authentication Failed';
    case 'refresh':
      return 'Session Expired';
    case 'logout':
      return 'Logout Error';
    default:
      return 'Authentication Error';
  }
}

function getAuthErrorDescription(error: AuthenticationError): string {
  switch (error.authStep) {
    case 'login':
      return `Failed to log in with ${error.provider || 'authentication provider'}. Please try again.`;
    case 'callback':
      return 'Authentication callback failed. Please try logging in again.';
    case 'refresh':
      return 'Your session has expired. Please log in again.';
    case 'logout':
      return 'An error occurred during logout. Your session has been cleared.';
    default:
      return error.message;
  }
}

function getAuthzErrorDescription(error: AuthorizationError): string {
  const resource = error.resource || 'this resource';
  const action = error.action || 'access';
  return `You do not have permission to ${action} ${resource}. Contact your administrator if you believe this is an error.`;
}

function getNetworkErrorTitle(error: NetworkError): string {
  if (error.status === 404) return 'Not Found';
  if (error.status === 429) return 'Rate Limited';
  if (error.status && error.status >= 500) return 'Server Error';
  if (!error.status) return 'Connection Error';
  return 'Network Error';
}

function getNetworkErrorDescription(error: NetworkError): string {
  if (error.status === 404) {
    return 'The requested resource was not found.';
  }
  if (error.status === 429) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  if (error.status && error.status >= 500) {
    return 'Server error occurred. Please try again later.';
  }
  if (!error.status) {
    return 'Unable to connect to the server. Please check your internet connection.';
  }
  return error.message;
}

function getDifyErrorTitle(error: DifyApiError, workflowName?: string): string {
  const name = workflowName || `Workflow ${error.workflowId || 'Unknown'}`;
  return `${name} Error`;
}

function getDifyErrorDescription(error: DifyApiError, workflowName?: string): string {
  const name = workflowName || 'workflow';
  
  switch (error.apiErrorCode) {
    case 'WORKFLOW_NOT_FOUND':
      return `${name} was not found or is no longer available.`;
    case 'INVALID_INPUT':
      return `Invalid input provided to ${name}. Please check your data.`;
    case 'WORKFLOW_BUSY':
      return `${name} is currently busy. Please try again in a moment.`;
    case 'EXECUTION_FAILED':
      return `${name} execution failed due to an internal error.`;
    default:
      return error.message;
  }
}

function getErrorColor(severity: ErrorSeverity): string {
  switch (severity) {
    case ErrorSeverity.LOW:
      return '#17a2b8';
    case ErrorSeverity.MEDIUM:
      return '#ffc107';
    case ErrorSeverity.HIGH:
      return '#fd7e14';
    case ErrorSeverity.CRITICAL:
      return '#dc3545';
    default:
      return '#6c757d';
  }
}

function getErrorIcon(type: ErrorType): string {
  switch (type) {
    case ErrorType.AUTHENTICATION_ERROR:
      return '🔐';
    case ErrorType.AUTHORIZATION_ERROR:
      return '🚫';
    case ErrorType.NETWORK_ERROR:
      return '🌐';
    case ErrorType.DIFY_API_ERROR:
      return '🔧';
    default:
      return '❌';
  }
}

function getErrorTitle(type: ErrorType): string {
  switch (type) {
    case ErrorType.AUTHENTICATION_ERROR:
      return 'Authentication Error';
    case ErrorType.AUTHORIZATION_ERROR:
      return 'Access Denied';
    case ErrorType.NETWORK_ERROR:
      return 'Network Error';
    case ErrorType.DIFY_API_ERROR:
      return 'Workflow Error';
    default:
      return 'Error';
  }
}

function getErrorMessage(error: AppError): string {
  return error.message;
}

// Add CSS animations
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInDown {
      from {
        transform: translateY(-100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    
    @keyframes slideInUp {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
}