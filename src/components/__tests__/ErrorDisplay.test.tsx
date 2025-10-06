/**
 * Tests for Error Display Components
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import {
  ErrorDisplay,
  CompactErrorDisplay,
  ErrorToast,
} from '../ErrorDisplay';
import {
  ErrorType,
  ErrorSeverity,
  ErrorRecoveryAction,
} from '../../types/error';
import { createError, createErrorContext } from '../../utils/errorUtils';

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

// Wrapper component for React Router
const RouterWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('ErrorDisplay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ErrorDisplay component', () => {
    it('should render basic error information', () => {
      const error = createError(ErrorType.NETWORK_ERROR, 'Network failed', {
        severity: ErrorSeverity.HIGH,
      });
      const context = createErrorContext('test-id');

      render(
        <RouterWrapper>
          <ErrorDisplay error={error} context={context} />
        </RouterWrapper>
      );

      expect(screen.getByText('Network Error')).toBeInTheDocument();
      expect(screen.getByText(/Network error occurred/)).toBeInTheDocument();
      expect(screen.getByText('🌐')).toBeInTheDocument();
    });

    it('should render custom title and description', () => {
      const error = createError(ErrorType.COMPONENT_ERROR, 'Component failed');
      const context = createErrorContext();

      render(
        <RouterWrapper>
          <ErrorDisplay
            error={error}
            context={context}
            options={{
              title: 'Custom Title',
              description: 'Custom description',
              icon: '🔥',
            }}
          />
        </RouterWrapper>
      );

      expect(screen.getByText('Custom Title')).toBeInTheDocument();
      expect(screen.getByText('Custom description')).toBeInTheDocument();
      expect(screen.getByText('🔥')).toBeInTheDocument();
    });

    it('should render retry button when onRetry is provided', () => {
      const error = createError(ErrorType.DIFY_API_ERROR, 'API failed');
      const context = createErrorContext();
      const mockRetry = jest.fn();

      render(
        <RouterWrapper>
          <ErrorDisplay error={error} context={context} onRetry={mockRetry} />
        </RouterWrapper>
      );

      const retryButton = screen.getByText('Try Again');
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);
      expect(mockRetry).toHaveBeenCalled();
    });

    it('should render custom actions', () => {
      const error = createError(ErrorType.AUTHENTICATION_ERROR, 'Auth failed');
      const context = createErrorContext();
      const mockAction = jest.fn();

      const customActions: ErrorRecoveryAction[] = [
        {
          label: 'Custom Action',
          action: mockAction,
          variant: 'primary',
        },
      ];

      render(
        <RouterWrapper>
          <ErrorDisplay
            error={error}
            context={context}
            actions={customActions}
          />
        </RouterWrapper>
      );

      const customButton = screen.getByText('Custom Action');
      expect(customButton).toBeInTheDocument();

      fireEvent.click(customButton);
      expect(mockAction).toHaveBeenCalled();
    });

    it('should render default action buttons', () => {
      const error = createError(ErrorType.ROUTE_ERROR, 'Route failed');
      const context = createErrorContext();

      render(
        <RouterWrapper>
          <ErrorDisplay error={error} context={context} />
        </RouterWrapper>
      );

      expect(screen.getByText('Reload Page')).toBeInTheDocument();
      expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
    });

    it('should render reload and dashboard buttons', () => {
      const error = createError(ErrorType.UNKNOWN_ERROR, 'Unknown error');
      const context = createErrorContext();

      render(
        <RouterWrapper>
          <ErrorDisplay error={error} context={context} />
        </RouterWrapper>
      );

      expect(screen.getByText('Reload Page')).toBeInTheDocument();
      expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
    });

    it('should show error details in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = createError(ErrorType.COMPONENT_ERROR, 'Component failed', {
        code: 'COMP_001',
        details: { componentName: 'TestComponent' },
      });
      const context = createErrorContext('dev-error-id', 'TestRoute');

      render(
        <RouterWrapper>
          <ErrorDisplay error={error} context={context} />
        </RouterWrapper>
      );

      expect(screen.getByText('Error Details (Development)')).toBeInTheDocument();
      expect(screen.getByText('dev-error-id')).toBeInTheDocument();
      expect(screen.getByText('COMPONENT_ERROR')).toBeInTheDocument();
      expect(screen.getByText('COMP_001')).toBeInTheDocument();
      expect(screen.getByText('TestRoute')).toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });

    it('should show stack trace in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = createError(ErrorType.ROUTE_ERROR, 'Route failed', {
        stack: 'Error: Route failed\n  at test.js:10:5',
      });
      const context = createErrorContext();

      render(
        <RouterWrapper>
          <ErrorDisplay
            error={error}
            context={context}
            options={{ showStack: true }}
          />
        </RouterWrapper>
      );

      expect(screen.getByText('Stack Trace (Development Only)')).toBeInTheDocument();
      expect(screen.getByText(/Error: Route failed/)).toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });

    it('should hide stack trace when showStack is false', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = createError(ErrorType.NETWORK_ERROR, 'Network failed', {
        stack: 'Error: Network failed\n  at test.js:10:5',
      });
      const context = createErrorContext();

      render(
        <RouterWrapper>
          <ErrorDisplay
            error={error}
            context={context}
            options={{ showStack: false }}
          />
        </RouterWrapper>
      );

      expect(screen.queryByText('Stack Trace (Development Only)')).not.toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });

    it('should apply custom className and style', () => {
      const error = createError(ErrorType.AUTHORIZATION_ERROR, 'Access denied');
      const context = createErrorContext();

      const { container } = render(
        <RouterWrapper>
          <ErrorDisplay
            error={error}
            context={context}
            className="custom-error"
            style={{ backgroundColor: 'red' }}
          />
        </RouterWrapper>
      );

      const errorDisplay = container.querySelector('.error-display');
      expect(errorDisplay).toHaveClass('custom-error');
      expect(errorDisplay).toHaveAttribute('style', expect.stringContaining('background-color: red'));
    });
  });

  describe('CompactErrorDisplay component', () => {
    it('should render compact error information', () => {
      const error = createError(ErrorType.VALIDATION_ERROR, 'Validation failed', {
        severity: ErrorSeverity.LOW,
      });

      render(
        <CompactErrorDisplay error={error} />
      );

      expect(screen.getByText('Validation Error')).toBeInTheDocument();
      expect(screen.getByText(/Invalid input/)).toBeInTheDocument();
      expect(screen.getByText('⚠️')).toBeInTheDocument();
    });

    it('should render retry button when onRetry is provided', () => {
      const error = createError(ErrorType.NETWORK_ERROR, 'Network failed');
      const mockRetry = jest.fn();

      render(
        <CompactErrorDisplay error={error} onRetry={mockRetry} />
      );

      const retryButton = screen.getByText('Retry');
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);
      expect(mockRetry).toHaveBeenCalled();
    });

    it('should render dismiss button when onDismiss is provided', () => {
      const error = createError(ErrorType.DIFY_API_ERROR, 'API failed');
      const mockDismiss = jest.fn();

      render(
        <CompactErrorDisplay error={error} onDismiss={mockDismiss} />
      );

      const dismissButton = screen.getByText('×');
      expect(dismissButton).toBeInTheDocument();

      fireEvent.click(dismissButton);
      expect(mockDismiss).toHaveBeenCalled();
    });

    it('should apply custom className', () => {
      const error = createError(ErrorType.AUTHENTICATION_ERROR, 'Auth failed');

      const { container } = render(
        <CompactErrorDisplay error={error} className="custom-compact" />
      );

      const compactDisplay = container.querySelector('.compact-error-display');
      expect(compactDisplay).toHaveClass('custom-compact');
    });
  });

  describe('ErrorToast component', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should render toast error information', () => {
      const error = createError(ErrorType.ROUTE_ERROR, 'Route failed', {
        severity: ErrorSeverity.MEDIUM,
      });
      const mockDismiss = jest.fn();

      render(
        <ErrorToast error={error} onDismiss={mockDismiss} />
      );

      expect(screen.getByText('Page Error')).toBeInTheDocument();
      expect(screen.getByText(/Page loading failed/)).toBeInTheDocument();
      expect(screen.getByText('🗺️')).toBeInTheDocument();
    });

    it('should auto-dismiss after duration', async () => {
      const error = createError(ErrorType.COMPONENT_ERROR, 'Component failed');
      const mockDismiss = jest.fn();

      render(
        <ErrorToast error={error} onDismiss={mockDismiss} duration={3000} />
      );

      expect(mockDismiss).not.toHaveBeenCalled();

      jest.advanceTimersByTime(3000);

      await waitFor(() => {
        expect(mockDismiss).toHaveBeenCalled();
      });
    });

    it('should use default duration', async () => {
      const error = createError(ErrorType.UNKNOWN_ERROR, 'Unknown error');
      const mockDismiss = jest.fn();

      render(
        <ErrorToast error={error} onDismiss={mockDismiss} />
      );

      jest.advanceTimersByTime(5000); // Default duration

      await waitFor(() => {
        expect(mockDismiss).toHaveBeenCalled();
      });
    });

    it('should handle manual dismiss', () => {
      const error = createError(ErrorType.AUTHORIZATION_ERROR, 'Access denied');
      const mockDismiss = jest.fn();

      render(
        <ErrorToast error={error} onDismiss={mockDismiss} />
      );

      const dismissButton = screen.getByText('×');
      fireEvent.click(dismissButton);

      expect(mockDismiss).toHaveBeenCalled();
    });

    it('should clean up timer on unmount', () => {
      const error = createError(ErrorType.NETWORK_ERROR, 'Network failed');
      const mockDismiss = jest.fn();

      const { unmount } = render(
        <ErrorToast error={error} onDismiss={mockDismiss} />
      );

      unmount();

      jest.advanceTimersByTime(5000);

      expect(mockDismiss).not.toHaveBeenCalled();
    });
  });

  describe('error type formatting', () => {
    const testCases = [
      {
        type: ErrorType.AUTHENTICATION_ERROR,
        expectedTitle: 'Authentication Error',
        expectedIcon: '🔐',
        expectedMessage: /Authentication failed/,
      },
      {
        type: ErrorType.AUTHORIZATION_ERROR,
        expectedTitle: 'Access Denied',
        expectedIcon: '🚫',
        expectedMessage: /You do not have permission/,
      },
      {
        type: ErrorType.NETWORK_ERROR,
        expectedTitle: 'Network Error',
        expectedIcon: '🌐',
        expectedMessage: /Network error occurred/,
      },
      {
        type: ErrorType.VALIDATION_ERROR,
        expectedTitle: 'Validation Error',
        expectedIcon: '⚠️',
        expectedMessage: /Invalid input/,
      },
      {
        type: ErrorType.DIFY_API_ERROR,
        expectedTitle: 'Workflow Error',
        expectedIcon: '🔧',
        expectedMessage: /Workflow execution failed/,
      },
      {
        type: ErrorType.ROUTE_ERROR,
        expectedTitle: 'Page Error',
        expectedIcon: '🗺️',
        expectedMessage: /Page loading failed/,
      },
      {
        type: ErrorType.COMPONENT_ERROR,
        expectedTitle: 'Component Error',
        expectedIcon: '⚙️',
        expectedMessage: /Component error occurred/,
      },
      {
        type: ErrorType.UNKNOWN_ERROR,
        expectedTitle: 'Unexpected Error',
        expectedIcon: '❌',
        expectedMessage: /An unexpected error occurred/,
      },
    ];

    testCases.forEach(({ type, expectedTitle, expectedIcon, expectedMessage }) => {
      it(`should format ${type} correctly`, () => {
        const error = createError(type, 'Test error');
        const context = createErrorContext();

        render(
          <RouterWrapper>
            <ErrorDisplay error={error} context={context} />
          </RouterWrapper>
        );

        expect(screen.getByText(expectedTitle)).toBeInTheDocument();
        expect(screen.getByText(expectedIcon)).toBeInTheDocument();
        expect(screen.getByText(expectedMessage)).toBeInTheDocument();
      });
    });
  });

  describe('severity colors', () => {
    it('should use appropriate colors for different severities', () => {
      const severityTests = [
        { severity: ErrorSeverity.LOW, expectedColor: '#17a2b8' },
        { severity: ErrorSeverity.MEDIUM, expectedColor: '#ffc107' },
        { severity: ErrorSeverity.HIGH, expectedColor: '#fd7e14' },
        { severity: ErrorSeverity.CRITICAL, expectedColor: '#dc3545' },
      ];

      severityTests.forEach(({ severity, expectedColor }) => {
        const error = createError(ErrorType.NETWORK_ERROR, 'Test error', { severity });
        const context = createErrorContext();

        const { container } = render(
          <RouterWrapper>
            <ErrorDisplay error={error} context={context} />
          </RouterWrapper>
        );

        const errorDisplay = container.querySelector('.error-display');
        expect(errorDisplay).toHaveStyle({ borderColor: expectedColor });
      });
    });
  });
});