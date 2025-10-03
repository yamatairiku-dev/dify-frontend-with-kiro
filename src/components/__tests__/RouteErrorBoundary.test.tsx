import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import { RouteErrorBoundary, withRouteErrorBoundary, useErrorBoundary } from '../RouteErrorBoundary';

// Mock console methods to avoid noise in tests
const originalConsoleError = console.error;
const originalConsoleGroup = console.group;
const originalConsoleGroupEnd = console.groupEnd;

beforeAll(() => {
  console.error = jest.fn();
  console.group = jest.fn();
  console.groupEnd = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.group = originalConsoleGroup;
  console.groupEnd = originalConsoleGroupEnd;
});

// Test components
const ThrowError: React.FC<{ shouldThrow?: boolean; errorMessage?: string }> = ({ 
  shouldThrow = false, 
  errorMessage = 'Test error' 
}) => {
  if (shouldThrow) {
    throw new Error(errorMessage);
  }
  return <div>No error</div>;
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
);

const CustomErrorFallback: React.FC<{ error: any; retry: () => void }> = ({ error, retry }) => (
  <div>
    <div>Custom error: {error.message}</div>
    <button onClick={retry}>Custom retry</button>
  </div>
);

describe('RouteErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render children when there is no error', () => {
    render(
      <TestWrapper>
        <RouteErrorBoundary>
          <ThrowError shouldThrow={false} />
        </RouteErrorBoundary>
      </TestWrapper>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should catch and display error with default fallback', () => {
    render(
      <TestWrapper>
        <RouteErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Test error message" />
        </RouteErrorBoundary>
      </TestWrapper>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Reload Page')).toBeInTheDocument();
  });

  it('should use custom fallback component when provided', () => {
    render(
      <TestWrapper>
        <RouteErrorBoundary fallback={CustomErrorFallback}>
          <ThrowError shouldThrow={true} errorMessage="Custom error message" />
        </RouteErrorBoundary>
      </TestWrapper>
    );

    expect(screen.getByText('Custom error: Custom error message')).toBeInTheDocument();
    expect(screen.getByText('Custom retry')).toBeInTheDocument();
  });

  it('should call onError callback when error occurs', () => {
    const onError = jest.fn();
    
    render(
      <TestWrapper>
        <RouteErrorBoundary onError={onError}>
          <ThrowError shouldThrow={true} errorMessage="Callback test error" />
        </RouteErrorBoundary>
      </TestWrapper>
    );

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    );
  });

  it('should reset error state when retry is clicked', async () => {
    let shouldThrow = true;
    
    const TestComponent: React.FC = () => {
      return <ThrowError shouldThrow={shouldThrow} />;
    };

    const { rerender } = render(
      <TestWrapper>
        <RouteErrorBoundary>
          <TestComponent />
        </RouteErrorBoundary>
      </TestWrapper>
    );

    // Error should be displayed initially
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    
    // Fix the error condition
    shouldThrow = false;
    
    // Click retry button
    fireEvent.click(screen.getByText('Try Again'));
    
    // Re-render with fixed condition
    rerender(
      <TestWrapper>
        <RouteErrorBoundary>
          <TestComponent />
        </RouteErrorBoundary>
      </TestWrapper>
    );
    
    // Should show the component content after retry
    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should include route name in error logging', () => {
    const onError = jest.fn();
    
    render(
      <TestWrapper>
        <RouteErrorBoundary routeName="TestRoute" onError={onError}>
          <ThrowError shouldThrow={true} />
        </RouteErrorBoundary>
      </TestWrapper>
    );

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    );
  });

  it('should show stack trace in development mode', () => {
    const originalEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'development';

    render(
      <TestWrapper>
        <RouteErrorBoundary>
          <ThrowError shouldThrow={true} />
        </RouteErrorBoundary>
      </TestWrapper>
    );

    expect(screen.getByText('Stack Trace (Development Only)')).toBeInTheDocument();

    process.env['NODE_ENV'] = originalEnv;
  });

  it('should not show stack trace in production mode', () => {
    const originalEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';

    render(
      <TestWrapper>
        <RouteErrorBoundary>
          <ThrowError shouldThrow={true} />
        </RouteErrorBoundary>
      </TestWrapper>
    );

    expect(screen.queryByText('Stack Trace (Development Only)')).not.toBeInTheDocument();

    process.env['NODE_ENV'] = originalEnv;
  });
});

describe('withRouteErrorBoundary HOC', () => {
  it('should wrap component with error boundary', () => {
    const TestComponent: React.FC = () => <ThrowError shouldThrow={false} />;
    const WrappedComponent = withRouteErrorBoundary(TestComponent, 'TestRoute');

    render(
      <TestWrapper>
        <WrappedComponent />
      </TestWrapper>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should catch errors in wrapped component', () => {
    const TestComponent: React.FC = () => <ThrowError shouldThrow={true} />;
    const WrappedComponent = withRouteErrorBoundary(TestComponent, 'TestRoute');

    render(
      <TestWrapper>
        <WrappedComponent />
      </TestWrapper>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should use custom fallback when provided', () => {
    const TestComponent: React.FC = () => <ThrowError shouldThrow={true} />;
    const WrappedComponent = withRouteErrorBoundary(
      TestComponent, 
      'TestRoute', 
      CustomErrorFallback
    );

    render(
      <TestWrapper>
        <WrappedComponent />
      </TestWrapper>
    );

    expect(screen.getByText('Custom error: Test error')).toBeInTheDocument();
  });

  it('should set correct display name', () => {
    const TestComponent: React.FC = () => <div>Test</div>;
    TestComponent.displayName = 'TestComponent';
    
    const WrappedComponent = withRouteErrorBoundary(TestComponent);
    
    expect(WrappedComponent.displayName).toBe('withRouteErrorBoundary(TestComponent)');
  });
});

describe('useErrorBoundary hook', () => {
  it('should trigger error boundary when called', () => {
    const TestComponent: React.FC = () => {
      const throwError = useErrorBoundary();
      
      return (
        <button onClick={() => throwError(new Error('Hook triggered error'))}>
          Trigger Error
        </button>
      );
    };

    render(
      <TestWrapper>
        <RouteErrorBoundary>
          <TestComponent />
        </RouteErrorBoundary>
      </TestWrapper>
    );

    fireEvent.click(screen.getByText('Trigger Error'));

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Hook triggered error')).toBeInTheDocument();
  });
});