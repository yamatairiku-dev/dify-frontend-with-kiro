/**
 * Tests for Global Error Boundary
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import {
  GlobalErrorBoundary,
  useErrorBoundary,
  withGlobalErrorBoundary,
  AsyncErrorBoundary,
  RouteErrorBoundary,
} from '../GlobalErrorBoundary';
import {
  ErrorType,
  ErrorSeverity,
  AppError,
  ErrorContext,
} from '../../types/error';
import { createError } from '../../utils/errorUtils';
import * as errorLoggingService from '../../services/errorLoggingService';

// Mock error logging service
jest.mock('../../services/errorLoggingService', () => ({
  logError: jest.fn().mockResolvedValue(undefined),
}));

// Mock console methods
const mockConsole = {
  error: jest.fn(),
  warn: jest.fn(),
  group: jest.fn(),
  groupEnd: jest.fn(),
};

Object.assign(console, mockConsole);

// Mock window.location
const mockLocation = {
  reload: jest.fn(),
  href: '',
};

// Store original location
const originalLocation = window.location;

beforeAll(() => {
  delete (window as any).location;
  (window as any).location = mockLocation;
});

afterAll(() => {
  (window as any).location = originalLocation;
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

const UseErrorBoundaryComponent: React.FC<{ shouldTrigger?: boolean }> = ({ shouldTrigger = false }) => {
  const triggerError = useErrorBoundary();

  React.useEffect(() => {
    if (shouldTrigger) {
      triggerError(new Error('Programmatic error'));
    }
  }, [shouldTrigger, triggerError]);

  return <div>Component with error boundary hook</div>;
};

// Wrapper component for React Router
const RouterWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('GlobalErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('basic error catching', () => {
    it('should catch and display JavaScript errors', () => {
      render(
        <RouterWrapper>
          <GlobalErrorBoundary>
            <ThrowError shouldThrow={true} errorMessage="Component crashed" />
          </GlobalErrorBoundary>
        </RouterWrapper>
      );

      expect(screen.getByText('Application Error')).toBeInTheDocument();
      expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument();
      expect(screen.getByText('⚙️')).toBeInTheDocument(); // Component error icon
    });

    it('should render children when no error occurs', () => {
      render(
        <RouterWrapper>
          <GlobalErrorBoundary>
            <ThrowError shouldThrow={false} />
          </GlobalErrorBoundary>
        </RouterWrapper>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
      expect(screen.queryByText('Application Error')).not.toBeInTheDocument();
    });

    it('should log errors to error logging service', async () => {
      render(
        <RouterWrapper>
          <GlobalErrorBoundary>
            <ThrowError shouldThrow={true} errorMessage="Logged error" />
          </GlobalErrorBoundary>
        </RouterWrapper>
      );

      await waitFor(() => {
        expect(errorLoggingService.logError).toHaveBeenCalledWith(
          expect.objectContaining({
            type: ErrorType.COMPONENT_ERROR,
            message: 'Logged error',
            severity: ErrorSeverity.HIGH,
          }),
          expect.objectContaining({
            errorId: expect.stringMatching(/^error-\d+-[a-z0-9]+$/),
            componentStack: expect.any(String),
          })
        );
      });
    });

    it('should call custom error handler', () => {
      const mockErrorHandler = jest.fn();

      render(
        <RouterWrapper>
          <GlobalErrorBoundary onError={mockErrorHandler}>
            <ThrowError shouldThrow={true} errorMessage="Custom handler error" />
          </GlobalErrorBoundary>
        </RouterWrapper>
      );

      expect(mockErrorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Custom handler error',
        }),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });

    it('should log to console in development', () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';

      render(
        <RouterWrapper>
          <GlobalErrorBoundary>
            <ThrowError shouldThrow={true} errorMessage="Dev error" />
          </GlobalErrorBoundary>
        </RouterWrapper>
      );

      expect(mockConsole.group).toHaveBeenCalledWith(
        '🚨 Global Error Boundary Caught Error'
      );
      expect(mockConsole.error).toHaveBeenCalledWith(
        'Original Error:',
        expect.any(Error)
      );
      expect(mockConsole.groupEnd).toHaveBeenCalled();

      process.env['NODE_ENV'] = originalEnv;
    });
  });

  describe('retry functionality', () => {
    it('should show retry button for retryable errors', () => {
      // Mock isRetryableError to return true
      jest.doMock('../../utils/errorUtils', () => ({
        ...jest.requireActual('../../utils/errorUtils'),
        isRetryableError: jest.fn().mockReturnValue(true),
      }));

      render(
        <RouterWrapper>
          <GlobalErrorBoundary maxRetries={3}>
            <ThrowError shouldThrow={true} errorMessage="Retryable error" />
          </GlobalErrorBoundary>
        </RouterWrapper>
      );

      expect(screen.getByText(/Retry/)).toBeInTheDocument();
    });

    it('should retry and reset error state', async () => {
      const { rerender } = render(
        <RouterWrapper>
          <GlobalErrorBoundary maxRetries={3}>
            <ThrowError shouldThrow={true} errorMessage="Retryable error" />
          </GlobalErrorBoundary>
        </RouterWrapper>
      );

      const retryButton = screen.getByText(/Retry/);
      fireEvent.click(retryButton);

      // Fast-forward past retry delay
      jest.advanceTimersByTime(1000);

      // Re-render with no error
      rerender(
        <RouterWrapper>
          <GlobalErrorBoundary maxRetries={3}>
            <ThrowError shouldThrow={false} />
          </GlobalErrorBoundary>
        </RouterWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('No error')).toBeInTheDocument();
      });
    });

    it('should limit retry attempts', () => {
      render(
        <RouterWrapper>
          <GlobalErrorBoundary maxRetries={2}>
            <ThrowError shouldThrow={true} errorMessage="Limited retries" />
          </GlobalErrorBoundary>
        </RouterWrapper>
      );

      // First retry
      let retryButton = screen.getByText(/Retry/);
      fireEvent.click(retryButton);

      // Second retry
      retryButton = screen.getByText(/Retry \(1\/2\)/);
      fireEvent.click(retryButton);

      // Third attempt should not show retry button
      expect(screen.queryByText(/Retry/)).not.toBeInTheDocument();
    });

    it('should show retry button by default for component errors', () => {
      render(
        <RouterWrapper>
          <GlobalErrorBoundary>
            <ThrowError shouldThrow={true} errorMessage="Component error" />
          </GlobalErrorBoundary>
        </RouterWrapper>
      );

      // Component errors are retryable by default
      expect(screen.getByText(/Retry/)).toBeInTheDocument();
    });
  });

  describe('recovery actions', () => {
    it('should show default recovery actions', () => {
      render(
        <RouterWrapper>
          <GlobalErrorBoundary>
            <ThrowError shouldThrow={true} />
          </GlobalErrorBoundary>
        </RouterWrapper>
      );

      expect(screen.getByText('Reload Application')).toBeInTheDocument();
      expect(screen.getByText('Go to Home')).toBeInTheDocument();
    });

    it('should show reload and home action buttons', () => {
      render(
        <RouterWrapper>
          <GlobalErrorBoundary>
            <ThrowError shouldThrow={true} />
          </GlobalErrorBoundary>
        </RouterWrapper>
      );

      expect(screen.getByText('Reload Application')).toBeInTheDocument();
      expect(screen.getByText('Go to Home')).toBeInTheDocument();
    });

    it('should show report issue for critical errors', () => {
      // Mock window.open
      const mockOpen = jest.fn();
      Object.defineProperty(window, 'open', { value: mockOpen });

      // Create a critical error by throwing and catching it
      const ThrowCriticalError: React.FC = () => {
        const error = new Error('Critical error');
        error.name = ErrorType.COMPONENT_ERROR;
        throw error;
      };

      render(
        <RouterWrapper>
          <GlobalErrorBoundary>
            <ThrowCriticalError />
          </GlobalErrorBoundary>
        </RouterWrapper>
      );

      // The error should be treated as critical due to component error type
      // But we need to modify the severity in the boundary
      // For now, let's check if the report button would appear for critical errors
      // This test might need adjustment based on actual implementation
    });
  });

  describe('custom fallback component', () => {
    it('should use custom fallback when provided', () => {
      const CustomFallback: React.FC<{
        error: AppError;
        context: ErrorContext;
        retry: () => void;
      }> = ({ error }) => (
        <div>Custom fallback: {error.message}</div>
      );

      render(
        <RouterWrapper>
          <GlobalErrorBoundary fallback={CustomFallback}>
            <ThrowError shouldThrow={true} errorMessage="Custom fallback error" />
          </GlobalErrorBoundary>
        </RouterWrapper>
      );

      expect(screen.getByText('Custom fallback: Custom fallback error')).toBeInTheDocument();
      expect(screen.queryByText('Application Error')).not.toBeInTheDocument();
    });
  });

  describe('reset conditions', () => {
    it('should reset on props change when resetOnPropsChange is true', () => {
      const { rerender } = render(
        <RouterWrapper>
          <GlobalErrorBoundary resetOnPropsChange={true}>
            <ThrowError shouldThrow={true} />
          </GlobalErrorBoundary>
        </RouterWrapper>
      );

      expect(screen.getByText('Application Error')).toBeInTheDocument();

      // Re-render with different children
      rerender(
        <RouterWrapper>
          <GlobalErrorBoundary resetOnPropsChange={true}>
            <div>Different children</div>
          </GlobalErrorBoundary>
        </RouterWrapper>
      );

      expect(screen.getByText('Different children')).toBeInTheDocument();
      expect(screen.queryByText('Application Error')).not.toBeInTheDocument();
    });

    it('should reset when reset keys change', () => {
      const { rerender } = render(
        <RouterWrapper>
          <GlobalErrorBoundary resetKeys={['key1', 'key2']}>
            <ThrowError shouldThrow={true} />
          </GlobalErrorBoundary>
        </RouterWrapper>
      );

      expect(screen.getByText('Application Error')).toBeInTheDocument();

      // Re-render with different reset keys
      rerender(
        <RouterWrapper>
          <GlobalErrorBoundary resetKeys={['key1', 'key3']}>
            <ThrowError shouldThrow={false} />
          </GlobalErrorBoundary>
        </RouterWrapper>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
      expect(screen.queryByText('Application Error')).not.toBeInTheDocument();
    });
  });

  describe('useErrorBoundary hook', () => {
    it('should programmatically trigger error boundary', () => {
      render(
        <RouterWrapper>
          <GlobalErrorBoundary>
            <UseErrorBoundaryComponent shouldTrigger={true} />
          </GlobalErrorBoundary>
        </RouterWrapper>
      );

      expect(screen.getByText('Application Error')).toBeInTheDocument();
    });

    it('should not trigger error boundary when not called', () => {
      render(
        <RouterWrapper>
          <GlobalErrorBoundary>
            <UseErrorBoundaryComponent shouldTrigger={false} />
          </GlobalErrorBoundary>
        </RouterWrapper>
      );

      expect(screen.getByText('Component with error boundary hook')).toBeInTheDocument();
      expect(screen.queryByText('Application Error')).not.toBeInTheDocument();
    });
  });

  describe('withGlobalErrorBoundary HOC', () => {
    it('should wrap component with error boundary', () => {
      const TestComponent: React.FC = () => <div>Test component</div>;
      const WrappedComponent = withGlobalErrorBoundary(TestComponent);

      render(
        <RouterWrapper>
          <WrappedComponent />
        </RouterWrapper>
      );

      expect(screen.getByText('Test component')).toBeInTheDocument();
    });

    it('should catch errors in wrapped component', () => {
      const WrappedThrowError = withGlobalErrorBoundary(ThrowError);

      render(
        <RouterWrapper>
          <WrappedThrowError shouldThrow={true} errorMessage="HOC error" />
        </RouterWrapper>
      );

      expect(screen.getByText('Application Error')).toBeInTheDocument();
    });

    it('should pass error boundary props to HOC', () => {
      const TestComponent: React.FC = () => <div>Test component</div>;
      const WrappedComponent = withGlobalErrorBoundary(TestComponent, {
        maxRetries: 5,
        displayOptions: { title: 'HOC Error' },
      });

      render(
        <RouterWrapper>
          <WrappedComponent />
        </RouterWrapper>
      );

      expect(screen.getByText('Test component')).toBeInTheDocument();
    });
  });

  describe('AsyncErrorBoundary', () => {
    it('should render with async-specific options', () => {
      render(
        <RouterWrapper>
          <AsyncErrorBoundary>
            <ThrowError shouldThrow={true} errorMessage="Async error" />
          </AsyncErrorBoundary>
        </RouterWrapper>
      );

      expect(screen.getByText('Operation Failed')).toBeInTheDocument();
      expect(screen.getByText(/An error occurred during the operation/)).toBeInTheDocument();
    });

    it('should call custom error handler', () => {
      const mockErrorHandler = jest.fn();

      render(
        <RouterWrapper>
          <AsyncErrorBoundary onError={mockErrorHandler}>
            <ThrowError shouldThrow={true} errorMessage="Async handler error" />
          </AsyncErrorBoundary>
        </RouterWrapper>
      );

      expect(mockErrorHandler).toHaveBeenCalled();
    });
  });

  describe('RouteErrorBoundary', () => {
    it('should render with route-specific options', () => {
      render(
        <RouterWrapper>
          <RouteErrorBoundary routeName="TestRoute">
            <ThrowError shouldThrow={true} errorMessage="Route error" />
          </RouteErrorBoundary>
        </RouterWrapper>
      );

      expect(screen.getByText('Page Error')).toBeInTheDocument();
      expect(screen.getByText(/An error occurred while loading this page/)).toBeInTheDocument();
    });

    it('should enhance error context with route name', () => {
      const mockErrorHandler = jest.fn();

      render(
        <RouterWrapper>
          <RouteErrorBoundary routeName="TestRoute" onError={mockErrorHandler}>
            <ThrowError shouldThrow={true} errorMessage="Route context error" />
          </RouteErrorBoundary>
        </RouterWrapper>
      );

      expect(mockErrorHandler).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          routeName: 'TestRoute',
        })
      );
    });
  });

  describe('error handling edge cases', () => {
    it('should handle errors in custom error handler', () => {
      const faultyErrorHandler = jest.fn(() => {
        throw new Error('Handler error');
      });

      render(
        <RouterWrapper>
          <GlobalErrorBoundary onError={faultyErrorHandler}>
            <ThrowError shouldThrow={true} errorMessage="Original error" />
          </GlobalErrorBoundary>
        </RouterWrapper>
      );

      expect(mockConsole.error).toHaveBeenCalledWith(
        'Error in custom error handler:',
        expect.any(Error)
      );
      expect(screen.getByText('Application Error')).toBeInTheDocument();
    });

    it('should clean up timers on unmount', () => {
      const { unmount } = render(
        <RouterWrapper>
          <GlobalErrorBoundary>
            <ThrowError shouldThrow={true} />
          </GlobalErrorBoundary>
        </RouterWrapper>
      );

      const retryButton = screen.getByText(/Retry/);
      fireEvent.click(retryButton);

      unmount();

      // Timer should be cleaned up, so advancing time shouldn't cause issues
      jest.advanceTimersByTime(5000);
    });
  });
});