/**
 * Global Error Boundary for Application-Wide Error Handling
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  AppError,
  ErrorContext,
  ErrorBoundaryState,
  ErrorBoundaryProps,
  ErrorRecoveryAction,
  ErrorType,
  ErrorSeverity,
} from '../types/error';
import { 
  createErrorContext, 
  fromJavaScriptError,
  isRetryableError,
} from '../utils/errorUtils';
import { logError } from '../services/errorLoggingService';
import { ErrorDisplay } from './ErrorDisplay';

/**
 * Global Error Boundary Component
 * Catches all unhandled JavaScript errors in the application
 */
export class GlobalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null;
  private readonly maxRetries: number;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.maxRetries = props.maxRetries || 3;
    
    this.state = {
      hasError: false,
      error: null,
      errorContext: null,
      retryCount: 0,
    };
  }

  /**
   * Static method to update state when an error occurs
   */
  static getDerivedStateFromError(jsError: Error): Partial<ErrorBoundaryState> {
    // Convert JavaScript error to AppError
    const appError = fromJavaScriptError(jsError, ErrorType.COMPONENT_ERROR, {
      severity: ErrorSeverity.HIGH,
    });

    // Create error context
    const errorContext = createErrorContext(
      undefined, // errorId will be generated
      'GlobalErrorBoundary',
      undefined // componentStack will be added in componentDidCatch
    );

    return {
      hasError: true,
      error: appError,
      errorContext,
    };
  }

  /**
   * Handle the error after it's caught
   */
  override componentDidCatch(jsError: Error, errorInfo: ErrorInfo): void {
    // Update error context with component stack
    const updatedContext: ErrorContext = {
      ...this.state.errorContext!,
      componentStack: errorInfo.componentStack || undefined,
    };

    // Update error with component stack
    const updatedError: AppError = {
      ...this.state.error!,
      componentStack: errorInfo.componentStack || undefined,
    };

    // Update state with enhanced error information
    this.setState({
      errorContext: updatedContext,
      error: updatedError,
    });

    // Log the error
    this.logErrorAsync(updatedError, updatedContext);

    // Call custom error handler if provided
    if (this.props.onError) {
      try {
        this.props.onError(updatedError, updatedContext);
      } catch (handlerError) {
        console.error('Error in custom error handler:', handlerError);
      }
    }

    // Log to console in development
    if (process.env['NODE_ENV'] === 'development') {
      console.group('🚨 Global Error Boundary Caught Error');
      console.error('Original Error:', jsError);
      console.error('Error Info:', errorInfo);
      console.error('App Error:', updatedError);
      console.error('Error Context:', updatedContext);
      console.groupEnd();
    }
  }

  /**
   * Handle component updates to check for reset conditions
   */
  override componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    const { resetOnPropsChange, resetKeys } = this.props;
    const { hasError } = this.state;

    // Reset error state if resetOnPropsChange is true and props changed
    if (hasError && resetOnPropsChange && prevProps.children !== this.props.children) {
      this.resetErrorBoundary();
      return;
    }

    // Reset error state if any reset key changed
    if (hasError && resetKeys && prevProps.resetKeys) {
      const hasResetKeyChanged = resetKeys.some((key, index) => 
        key !== prevProps.resetKeys![index]
      );
      
      if (hasResetKeyChanged) {
        this.resetErrorBoundary();
      }
    }
  }

  /**
   * Clean up timers on unmount
   */
  override componentWillUnmount(): void {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  /**
   * Log error asynchronously to prevent blocking
   */
  private async logErrorAsync(error: AppError, context: ErrorContext): Promise<void> {
    try {
      await logError(error, context);
    } catch (loggingError) {
      console.error('Failed to log error:', loggingError);
    }
  }

  /**
   * Reset error boundary state
   */
  private resetErrorBoundary = (): void => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    this.setState({
      hasError: false,
      error: null,
      errorContext: null,
      retryCount: 0,
    });
  };

  /**
   * Retry with error recovery
   */
  private retry = (): void => {
    const { error } = this.state;
    
    if (!error) {
      this.resetErrorBoundary();
      return;
    }

    // Check if error is retryable
    if (!isRetryableError(error)) {
      console.warn('Attempted to retry non-retryable error:', error.type);
      return;
    }

    // Check retry limit
    if (this.state.retryCount >= this.maxRetries) {
      console.warn('Maximum retry attempts reached');
      return;
    }

    // Increment retry count
    this.setState(prevState => ({
      retryCount: prevState.retryCount + 1,
    }));

    // Add delay before retry to prevent rapid retries
    const retryDelay = Math.min(1000 * Math.pow(2, this.state.retryCount), 5000);
    
    this.retryTimeoutId = setTimeout(() => {
      this.resetErrorBoundary();
    }, retryDelay);
  };

  /**
   * Get default recovery actions
   */
  private getDefaultActions(): ErrorRecoveryAction[] {
    const { error } = this.state;
    const actions: ErrorRecoveryAction[] = [];

    // Add retry action if error is retryable and under retry limit
    if (error && isRetryableError(error) && this.state.retryCount < this.maxRetries) {
      actions.push({
        label: `Retry ${this.state.retryCount > 0 ? `(${this.state.retryCount}/${this.maxRetries})` : ''}`,
        action: this.retry,
        primary: true,
        variant: 'primary',
      });
    }

    // Add reload action
    actions.push({
      label: 'Reload Application',
      action: () => window.location.reload(),
      variant: 'secondary',
    });

    // Add home navigation
    actions.push({
      label: 'Go to Home',
      action: () => {
        window.location.href = '/';
      },
      variant: 'secondary',
    });

    // Add report action for critical errors
    if (error && error.severity === ErrorSeverity.CRITICAL) {
      actions.push({
        label: 'Report Issue',
        action: () => {
          // Open issue reporting (could be email, support form, etc.)
          const subject = encodeURIComponent(`Error Report: ${error.type}`);
          const body = encodeURIComponent(
            `Error ID: ${this.state.errorContext?.errorId}\n` +
            `Type: ${error.type}\n` +
            `Message: ${error.message}\n` +
            `Timestamp: ${error.timestamp.toISOString()}\n` +
            `URL: ${this.state.errorContext?.url}\n\n` +
            'Please describe what you were doing when this error occurred:'
          );
          window.open(`mailto:support@example.com?subject=${subject}&body=${body}`);
        },
        variant: 'danger',
      });
    }

    return actions;
  }

  /**
   * Render method
   */
  override render(): ReactNode {
    const { hasError, error, errorContext } = this.state;
    const { children, fallback: CustomFallback, displayOptions } = this.props;

    // Render children if no error
    if (!hasError || !error || !errorContext) {
      return children;
    }

    // Use custom fallback if provided
    if (CustomFallback) {
      return (
        <CustomFallback
          error={error}
          context={errorContext}
          retry={this.retry}
          actions={this.getDefaultActions()}
        />
      );
    }

    // Use default error display
    return (
      <ErrorDisplay
        error={error}
        context={errorContext}
        onRetry={isRetryableError(error) && this.state.retryCount < this.maxRetries ? this.retry : undefined}
        actions={this.getDefaultActions()}
        options={{
          title: 'Application Error',
          description: 'An unexpected error occurred in the application.',
          showStack: process.env['NODE_ENV'] === 'development',
          showRetry: false, // Handled by actions
          showReload: false, // Handled by actions
          showGoHome: false, // Handled by actions
          ...displayOptions,
        }}
        style={{
          minHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      />
    );
  }
}

/**
 * Hook for programmatically triggering the error boundary
 */
export const useErrorBoundary = () => {
  const [, setState] = React.useState();
  
  return React.useCallback((error: Error | AppError) => {
    setState(() => {
      if (error instanceof Error) {
        throw error;
      } else {
        // Convert AppError to JavaScript Error to trigger boundary
        const jsError = new Error(error.message);
        jsError.name = error.type;
        jsError.stack = error.stack;
        throw jsError;
      }
    });
  }, []);
};

/**
 * Higher-order component for wrapping components with global error boundary
 */
export const withGlobalErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Partial<ErrorBoundaryProps>
) => {
  const WrappedComponent: React.FC<P> = (props) => (
    <GlobalErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </GlobalErrorBoundary>
  );

  WrappedComponent.displayName = `withGlobalErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};

/**
 * Error boundary specifically for async operations
 */
export const AsyncErrorBoundary: React.FC<{
  children: ReactNode;
  onError?: (error: AppError, context: ErrorContext) => void;
}> = ({ children, onError }) => {
  return (
    <GlobalErrorBoundary
      onError={onError}
      maxRetries={1}
      resetOnPropsChange={true}
      displayOptions={{
        title: 'Operation Failed',
        description: 'An error occurred during the operation.',
        showRetry: true,
      }}
    >
      {children}
    </GlobalErrorBoundary>
  );
};

/**
 * Error boundary for route-level errors
 */
export const RouteErrorBoundary: React.FC<{
  children: ReactNode;
  routeName?: string;
  onError?: (error: AppError, context: ErrorContext) => void;
}> = ({ children, routeName, onError }) => {
  return (
    <GlobalErrorBoundary
      onError={(error, context) => {
        // Add route information to context
        const enhancedContext = {
          ...context,
          routeName: routeName || context.routeName,
        };
        
        if (onError) {
          onError(error, enhancedContext);
        }
      }}
      displayOptions={{
        title: 'Page Error',
        description: 'An error occurred while loading this page.',
      }}
    >
      {children}
    </GlobalErrorBoundary>
  );
};