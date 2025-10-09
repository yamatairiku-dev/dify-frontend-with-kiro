/**
 * User-Friendly Error Display Components
 */

import React from 'react';
import { Link } from 'react-router';
import {
  AppError,
  ErrorContext,
  ErrorRecoveryAction,
  ErrorDisplayOptions,
  ErrorType,
  ErrorSeverity,
} from '../types/error';
import { formatErrorForDisplay } from '../utils/errorUtils';

/**
 * Props for ErrorDisplay component
 */
interface ErrorDisplayProps {
  error: AppError;
  context: ErrorContext;
  onRetry?: () => void;
  actions?: ErrorRecoveryAction[];
  options?: ErrorDisplayOptions;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Main error display component
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  context,
  onRetry,
  actions = [],
  options = {},
  className = '',
  style = {},
}) => {
  const {
    showStack = process.env['NODE_ENV'] === 'development',
    showRetry = true,
    showReload = true,
    showGoHome = true,
    customActions = [],
    title,
    description,
    icon,
  } = options;

  const errorIcon = icon || getErrorIcon(error.type);
  const errorTitle = title || getErrorTitle(error.type);
  const errorDescription = description || formatErrorForDisplay(error);
  const errorColor = getErrorColor(error.severity);

  // Combine default and custom actions
  const allActions = [
    ...customActions,
    ...actions,
    ...(showRetry && onRetry ? [{
      label: 'Try Again',
      action: onRetry,
      primary: true,
      variant: 'primary' as const,
    }] : []),
    ...(showReload ? [{
      label: 'Reload Page',
      action: () => window.location.reload(),
      variant: 'secondary' as const,
    }] : []),
    ...(showGoHome ? [{
      label: 'Go to Dashboard',
      action: () => window.location.href = '/',
      variant: 'secondary' as const,
    }] : []),
  ];

  return (
    <div
      className={`error-display ${className}`}
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        lineHeight: '1.6',
        maxWidth: '800px',
        margin: '2rem auto',
        padding: '2rem',
        border: `2px solid ${errorColor}`,
        borderRadius: '12px',
        backgroundColor: '#ffffff',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        ...style,
      }}
    >
      {/* Header */}
      <div style={{
        textAlign: 'center',
        marginBottom: '2rem',
      }}>
        <div style={{
          fontSize: '4rem',
          marginBottom: '1rem',
          filter: 'grayscale(20%)',
        }}>
          {errorIcon}
        </div>
        
        <h1 style={{
          color: errorColor,
          margin: '0 0 1rem 0',
          fontSize: '1.75rem',
          fontWeight: '600',
        }}>
          {errorTitle}
        </h1>
        
        <p style={{
          fontSize: '1.1rem',
          color: '#666',
          margin: '0',
          maxWidth: '600px',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          {errorDescription}
        </p>
      </div>

      {/* Error Details */}
      {process.env['NODE_ENV'] === 'development' && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          marginBottom: '2rem',
        }}>
          <h3 style={{
            margin: '0 0 1rem 0',
            color: '#495057',
            fontSize: '1rem',
            fontWeight: '600',
          }}>
            Error Details (Development)
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '0.5rem 1rem',
            fontSize: '0.9rem',
            color: '#6c757d',
          }}>
            <strong>Error ID:</strong>
            <span style={{ fontFamily: 'monospace' }}>{context.errorId}</span>
            
            <strong>Type:</strong>
            <span>{error.type}</span>
            
            <strong>Severity:</strong>
            <span>{error.severity}</span>
            
            <strong>Timestamp:</strong>
            <span>{error.timestamp.toLocaleString()}</span>
            
            {error.code && (
              <>
                <strong>Code:</strong>
                <span>{error.code}</span>
              </>
            )}
            
            {context.routeName && (
              <>
                <strong>Route:</strong>
                <span>{context.routeName}</span>
              </>
            )}
          </div>

          {error.details && (
            <details style={{ marginTop: '1rem' }}>
              <summary style={{
                cursor: 'pointer',
                fontWeight: '600',
                marginBottom: '0.5rem',
              }}>
                Additional Details
              </summary>
              <pre style={{
                fontSize: '0.8rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: '0',
                padding: '0.5rem',
                backgroundColor: '#ffffff',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '200px',
              }}>
                {JSON.stringify(error.details, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* Actions */}
      {allActions.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginBottom: showStack && error.stack ? '2rem' : '0',
        }}>
          {allActions.map((action, index) => (
            <button
              key={index}
              onClick={action.action}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                fontWeight: '500',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                minWidth: '120px',
                ...getActionButtonStyle(action.variant || 'secondary', action.primary),
              }}
              onMouseEnter={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.transform = 'translateY(-1px)';
                target.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
              }}
              onMouseLeave={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.transform = 'translateY(0)';
                target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Stack Trace (Development Only) */}
      {showStack && error.stack && process.env['NODE_ENV'] === 'development' && (
        <details style={{
          padding: '1rem',
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
        }}>
          <summary style={{
            cursor: 'pointer',
            fontWeight: '600',
            marginBottom: '1rem',
            color: '#495057',
          }}>
            Stack Trace (Development Only)
          </summary>
          <pre style={{
            fontSize: '0.8rem',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: '0',
            color: '#495057',
            overflow: 'auto',
            maxHeight: '300px',
          }}>
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  );
};

/**
 * Compact error display for inline use
 */
export const CompactErrorDisplay: React.FC<{
  error: AppError;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}> = ({ error, onRetry, onDismiss, className = '' }) => {
  const errorColor = getErrorColor(error.severity);
  const errorIcon = getErrorIcon(error.type);

  return (
    <div
      className={`compact-error-display ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '1rem',
        backgroundColor: '#fff5f5',
        border: `1px solid ${errorColor}`,
        borderRadius: '8px',
        fontSize: '0.9rem',
        margin: '1rem 0',
      }}
    >
      <span style={{ fontSize: '1.5rem' }}>{errorIcon}</span>
      
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: '600', color: errorColor, marginBottom: '0.25rem' }}>
          {getErrorTitle(error.type)}
        </div>
        <div style={{ color: '#666' }}>
          {formatErrorForDisplay(error)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.8rem',
              backgroundColor: '#0078d4',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        )}
        
        {onDismiss && (
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
        )}
      </div>
    </div>
  );
};

/**
 * Error toast notification
 */
export const ErrorToast: React.FC<{
  error: AppError;
  onDismiss: () => void;
  duration?: number;
}> = ({ error, onDismiss, duration = 5000 }) => {
  React.useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [onDismiss, duration]);

  const errorColor = getErrorColor(error.severity);

  return (
    <div
      style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        zIndex: 9999,
        maxWidth: '400px',
        padding: '1rem',
        backgroundColor: 'white',
        border: `2px solid ${errorColor}`,
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        animation: 'slideInRight 0.3s ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <span style={{ fontSize: '1.25rem' }}>{getErrorIcon(error.type)}</span>
        
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: '600', color: errorColor, marginBottom: '0.25rem' }}>
            {getErrorTitle(error.type)}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#666' }}>
            {formatErrorForDisplay(error)}
          </div>
        </div>

        <button
          onClick={onDismiss}
          style={{
            padding: '0.25rem',
            fontSize: '1.25rem',
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

/**
 * Get error icon based on error type
 */
const getErrorIcon = (type: ErrorType): string => {
  switch (type) {
    case ErrorType.AUTHENTICATION_ERROR:
      return '🔐';
    case ErrorType.AUTHORIZATION_ERROR:
      return '🚫';
    case ErrorType.NETWORK_ERROR:
      return '🌐';
    case ErrorType.VALIDATION_ERROR:
      return '⚠️';
    case ErrorType.DIFY_API_ERROR:
      return '🔧';
    case ErrorType.ROUTE_ERROR:
      return '🗺️';
    case ErrorType.COMPONENT_ERROR:
      return '⚙️';
    case ErrorType.UNKNOWN_ERROR:
    default:
      return '❌';
  }
};

/**
 * Get error title based on error type
 */
const getErrorTitle = (type: ErrorType): string => {
  switch (type) {
    case ErrorType.AUTHENTICATION_ERROR:
      return 'Authentication Error';
    case ErrorType.AUTHORIZATION_ERROR:
      return 'Access Denied';
    case ErrorType.NETWORK_ERROR:
      return 'Network Error';
    case ErrorType.VALIDATION_ERROR:
      return 'Validation Error';
    case ErrorType.DIFY_API_ERROR:
      return 'Workflow Error';
    case ErrorType.ROUTE_ERROR:
      return 'Page Error';
    case ErrorType.COMPONENT_ERROR:
      return 'Component Error';
    case ErrorType.UNKNOWN_ERROR:
    default:
      return 'Unexpected Error';
  }
};

/**
 * Get error color based on severity
 */
const getErrorColor = (severity: ErrorSeverity): string => {
  switch (severity) {
    case ErrorSeverity.LOW:
      return '#17a2b8'; // Info blue
    case ErrorSeverity.MEDIUM:
      return '#ffc107'; // Warning yellow
    case ErrorSeverity.HIGH:
      return '#fd7e14'; // Orange
    case ErrorSeverity.CRITICAL:
      return '#dc3545'; // Danger red
    default:
      return '#6c757d'; // Gray
  }
};

/**
 * Get button style based on variant
 */
const getActionButtonStyle = (
  variant: 'primary' | 'secondary' | 'danger',
  isPrimary?: boolean
): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  };

  if (isPrimary || variant === 'primary') {
    return {
      ...baseStyle,
      backgroundColor: '#0078d4',
      color: 'white',
    };
  }

  if (variant === 'danger') {
    return {
      ...baseStyle,
      backgroundColor: '#dc3545',
      color: 'white',
    };
  }

  // Secondary
  return {
    ...baseStyle,
    backgroundColor: '#6c757d',
    color: 'white',
  };
};

// Add CSS animation for toast
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
}