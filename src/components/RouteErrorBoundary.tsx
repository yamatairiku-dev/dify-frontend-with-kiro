import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Link } from 'react-router';

/**
 * Error information interface
 */
interface ErrorDetails {
  message: string;
  stack?: string;
  componentStack?: string | null;
  errorBoundary?: string;
  errorInfo?: ErrorInfo;
}

/**
 * Props for RouteErrorBoundary
 */
interface RouteErrorBoundaryProps {
  children: ReactNode;
  fallback?: React.ComponentType<{ error: ErrorDetails; retry: () => void }>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  routeName?: string;
}

/**
 * State for RouteErrorBoundary
 */
interface RouteErrorBoundaryState {
  hasError: boolean;
  error: ErrorDetails | null;
  errorId: string | null;
}

/**
 * Default error fallback component
 */
const DefaultErrorFallback: React.FC<{ error: ErrorDetails; retry: () => void }> = ({ error, retry }) => (
  <div style={{
    fontFamily: 'system-ui, sans-serif',
    lineHeight: '1.8',
    maxWidth: '800px',
    margin: '2rem auto',
    padding: '2rem',
    border: '1px solid #ff6b6b',
    borderRadius: '8px',
    backgroundColor: '#ffe0e0'
  }}>
    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
      <h1 style={{ color: '#d63031', margin: '0 0 1rem 0' }}>Something went wrong</h1>
      <p style={{ fontSize: '1.1rem', color: '#666', margin: '0' }}>
        An error occurred while loading this page.
      </p>
    </div>

    <div style={{
      padding: '1rem',
      backgroundColor: '#f9f9f9',
      border: '1px solid #ddd',
      borderRadius: '4px',
      marginBottom: '2rem'
    }}>
      <h3 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>Error Details:</h3>
      <p style={{ 
        margin: '0', 
        fontFamily: 'monospace', 
        fontSize: '0.9rem',
        color: '#d63031',
        wordBreak: 'break-word'
      }}>
        {error.message}
      </p>
    </div>

    <div style={{ 
      display: 'flex', 
      gap: '1rem', 
      justifyContent: 'center',
      flexWrap: 'wrap'
    }}>
      <button
        onClick={retry}
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: '#0078d4',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '1rem'
        }}
      >
        Try Again
      </button>
      
      <Link
        to="/"
        style={{
          display: 'inline-block',
          padding: '0.75rem 1.5rem',
          backgroundColor: '#00b894',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '4px',
          fontSize: '1rem'
        }}
      >
        Go to Dashboard
      </Link>
      
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: '#6c757d',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '1rem'
        }}
      >
        Reload Page
      </button>
    </div>

    {process.env['NODE_ENV'] === 'development' && error.stack && (
      <details style={{ 
        marginTop: '2rem',
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '4px'
      }}>
        <summary style={{ 
          cursor: 'pointer', 
          fontWeight: 'bold',
          marginBottom: '1rem'
        }}>
          Stack Trace (Development Only)
        </summary>
        <pre style={{ 
          fontSize: '0.8rem',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          margin: '0',
          color: '#495057'
        }}>
          {error.stack}
        </pre>
      </details>
    )}
  </div>
);

/**
 * Route-level error boundary component
 * Catches JavaScript errors anywhere in the child component tree
 */
export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<RouteErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error: {
        message: error.message,
        stack: error.stack,
      },
      errorId
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error details
    const errorDetails: ErrorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorBoundary: this.props.routeName || 'RouteErrorBoundary',
      errorInfo
    };

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to console in development
    if (process.env['NODE_ENV'] === 'development') {
      console.group('🚨 Route Error Boundary Caught Error');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Route:', this.props.routeName || 'Unknown');
      console.groupEnd();
    }

    // Update state with full error details
    this.setState(prevState => ({
      ...prevState,
      error: errorDetails
    }));

    // Report to error tracking service in production
    if (process.env['NODE_ENV'] === 'production') {
      // TODO: Integrate with error tracking service (e.g., Sentry)
      // reportError(error, errorInfo, this.props.routeName);
    }
  }

  /**
   * Retry function to reset error state
   */
  retry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorId: null
    });
  };

  override render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      
      return (
        <FallbackComponent 
          error={this.state.error} 
          retry={this.retry}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component for wrapping routes with error boundary
 */
export const withRouteErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  routeName?: string,
  customFallback?: React.ComponentType<{ error: ErrorDetails; retry: () => void }>
) => {
  const WrappedComponent: React.FC<P> = (props) => (
    <RouteErrorBoundary 
      routeName={routeName}
      fallback={customFallback}
    >
      <Component {...props} />
    </RouteErrorBoundary>
  );

  WrappedComponent.displayName = `withRouteErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};

/**
 * Hook for programmatically triggering error boundary
 * Useful for async error handling
 */
export const useErrorBoundary = () => {
  const [, setState] = React.useState();
  
  return React.useCallback((error: Error) => {
    setState(() => {
      throw error;
    });
  }, []);
};