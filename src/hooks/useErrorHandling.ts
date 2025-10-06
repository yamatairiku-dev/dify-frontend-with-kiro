/**
 * Error Handling Hooks
 * Provides React hooks for handling specific error scenarios with automatic retry
 */

import { useCallback, useState, useRef } from 'react';
import {
  AppError,
  ErrorType,
  AuthenticationError,
  AuthorizationError,
  NetworkError,
  DifyApiError,
} from '../types/error';
import {
  AuthenticationErrorHandler,
  AuthorizationErrorHandler,
  NetworkErrorHandler,
  DifyApiErrorHandler,
  UnifiedErrorHandler,
} from '../services/specificErrorHandlers';
import { useAuth } from '../context/AuthContext';

/**
 * Error handling state
 */
interface ErrorHandlingState {
  isRetrying: boolean;
  retryCount: number;
  lastError: AppError | null;
  canRetry: boolean;
}

/**
 * Error handling options
 */
interface ErrorHandlingOptions {
  maxRetries?: number;
  onError?: (error: AppError) => void;
  onRetrySuccess?: () => void;
  onRetryFailure?: (error: AppError) => void;
  showToast?: boolean;
}

/**
 * Hook for handling authentication errors with automatic retry
 */
export const useAuthenticationErrorHandling = (options: ErrorHandlingOptions = {}) => {
  const { logout } = useAuth();
  const [state, setState] = useState<ErrorHandlingState>({
    isRetrying: false,
    retryCount: 0,
    lastError: null,
    canRetry: false,
  });

  const handleAuthError = useCallback(async (
    error: AuthenticationError,
    operation: () => Promise<any>,
    context?: { provider?: string; authStep?: string }
  ) => {
    setState(prev => ({
      ...prev,
      lastError: error,
      canRetry: true,
    }));

    if (options.onError) {
      options.onError(error);
    }

    try {
      setState(prev => ({ ...prev, isRetrying: true }));
      
      const result = await AuthenticationErrorHandler.handleAuthenticationError(
        error,
        operation,
        context
      );

      setState(prev => ({
        ...prev,
        isRetrying: false,
        retryCount: 0,
        lastError: null,
        canRetry: false,
      }));

      if (options.onRetrySuccess) {
        options.onRetrySuccess();
      }

      return result;
    } catch (retryError) {
      setState(prev => ({
        ...prev,
        isRetrying: false,
        retryCount: prev.retryCount + 1,
        lastError: retryError as AppError,
        canRetry: false,
      }));

      if (options.onRetryFailure) {
        options.onRetryFailure(retryError as AppError);
      }

      // If authentication completely fails, logout the user
      if ((retryError as AuthenticationError).code === 'AUTH_SESSION_EXPIRED') {
        await logout();
      }

      throw retryError;
    }
  }, [logout, options]);

  const retry = useCallback(async (operation: () => Promise<any>) => {
    if (!state.lastError || !state.canRetry) {
      return;
    }

    return handleAuthError(
      state.lastError as AuthenticationError,
      operation
    );
  }, [state.lastError, state.canRetry, handleAuthError]);

  return {
    ...state,
    handleAuthError,
    retry,
  };
};

/**
 * Hook for handling authorization errors with clear messaging
 */
export const useAuthorizationErrorHandling = (options: ErrorHandlingOptions = {}) => {
  const { user } = useAuth();
  const [state, setState] = useState<ErrorHandlingState>({
    isRetrying: false,
    retryCount: 0,
    lastError: null,
    canRetry: false,
  });

  const handleAuthzError = useCallback(async (
    error: AuthorizationError,
    context?: { 
      resource?: string; 
      action?: string; 
      routeName?: string;
    }
  ) => {
    setState(prev => ({
      ...prev,
      lastError: error,
      canRetry: false, // Authorization errors are not retryable
    }));

    if (options.onError) {
      options.onError(error);
    }

    try {
      // Add user permissions to context for better error messaging
      const enhancedContext = {
        ...context,
        userPermissions: user?.permissions?.map(p => `${p.resource}:${p.actions.join(',')}`),
      };

      await AuthorizationErrorHandler.handleAuthorizationError(error, enhancedContext);
    } catch (authzError) {
      setState(prev => ({
        ...prev,
        lastError: authzError as AppError,
      }));

      if (options.onRetryFailure) {
        options.onRetryFailure(authzError as AppError);
      }

      throw authzError;
    }
  }, [user, options]);

  return {
    ...state,
    handleAuthzError,
  };
};

/**
 * Hook for handling network errors with retry mechanisms
 */
export const useNetworkErrorHandling = (options: ErrorHandlingOptions = {}) => {
  const [state, setState] = useState<ErrorHandlingState>({
    isRetrying: false,
    retryCount: 0,
    lastError: null,
    canRetry: false,
  });

  const handleNetworkError = useCallback(async (
    error: NetworkError,
    operation: () => Promise<any>,
    context?: { endpoint?: string; method?: string }
  ) => {
    setState(prev => ({
      ...prev,
      lastError: error,
      canRetry: true,
    }));

    if (options.onError) {
      options.onError(error);
    }

    try {
      setState(prev => ({ ...prev, isRetrying: true }));
      
      const result = await NetworkErrorHandler.handleNetworkError(
        error,
        operation,
        context
      );

      setState(prev => ({
        ...prev,
        isRetrying: false,
        retryCount: 0,
        lastError: null,
        canRetry: false,
      }));

      if (options.onRetrySuccess) {
        options.onRetrySuccess();
      }

      return result;
    } catch (retryError) {
      setState(prev => ({
        ...prev,
        isRetrying: false,
        retryCount: prev.retryCount + 1,
        lastError: retryError as AppError,
        canRetry: (retryError as NetworkError).retryCount < (options.maxRetries || 3),
      }));

      if (options.onRetryFailure) {
        options.onRetryFailure(retryError as AppError);
      }

      throw retryError;
    }
  }, [options]);

  const retry = useCallback(async (operation: () => Promise<any>) => {
    if (!state.lastError || !state.canRetry) {
      return;
    }

    return handleNetworkError(
      state.lastError as NetworkError,
      operation
    );
  }, [state.lastError, state.canRetry, handleNetworkError]);

  return {
    ...state,
    handleNetworkError,
    retry,
  };
};

/**
 * Hook for handling Dify API errors with workflow-specific messaging
 */
export const useDifyApiErrorHandling = (options: ErrorHandlingOptions = {}) => {
  const [state, setState] = useState<ErrorHandlingState>({
    isRetrying: false,
    retryCount: 0,
    lastError: null,
    canRetry: false,
  });

  const handleDifyError = useCallback(async (
    error: DifyApiError,
    operation: () => Promise<any>,
    context?: { 
      workflowId?: string; 
      workflowName?: string;
      executionId?: string;
    }
  ) => {
    setState(prev => ({
      ...prev,
      lastError: error,
      canRetry: true,
    }));

    if (options.onError) {
      options.onError(error);
    }

    try {
      setState(prev => ({ ...prev, isRetrying: true }));
      
      const result = await DifyApiErrorHandler.handleDifyApiError(
        error,
        operation,
        context
      );

      setState(prev => ({
        ...prev,
        isRetrying: false,
        retryCount: 0,
        lastError: null,
        canRetry: false,
      }));

      if (options.onRetrySuccess) {
        options.onRetrySuccess();
      }

      return result;
    } catch (retryError) {
      setState(prev => ({
        ...prev,
        isRetrying: false,
        retryCount: prev.retryCount + 1,
        lastError: retryError as AppError,
        canRetry: (retryError as DifyApiError).details?.retryCount < (options.maxRetries || 3),
      }));

      if (options.onRetryFailure) {
        options.onRetryFailure(retryError as AppError);
      }

      throw retryError;
    }
  }, [options]);

  const retry = useCallback(async (operation: () => Promise<any>) => {
    if (!state.lastError || !state.canRetry) {
      return;
    }

    return handleDifyError(
      state.lastError as DifyApiError,
      operation
    );
  }, [state.lastError, state.canRetry, handleDifyError]);

  return {
    ...state,
    handleDifyError,
    retry,
  };
};

/**
 * Unified error handling hook that handles all error types
 */
export const useUnifiedErrorHandling = (options: ErrorHandlingOptions = {}) => {
  const authErrorHandling = useAuthenticationErrorHandling(options);
  const authzErrorHandling = useAuthorizationErrorHandling(options);
  const networkErrorHandling = useNetworkErrorHandling(options);
  const difyErrorHandling = useDifyApiErrorHandling(options);

  const [globalState, setGlobalState] = useState<ErrorHandlingState>({
    isRetrying: false,
    retryCount: 0,
    lastError: null,
    canRetry: false,
  });

  const handleError = useCallback(async (
    error: AppError,
    operation: () => Promise<any>,
    context?: any
  ) => {
    setGlobalState(prev => ({
      ...prev,
      lastError: error,
    }));

    try {
      const result = await UnifiedErrorHandler.handleError(error, operation, context);
      
      setGlobalState(prev => ({
        ...prev,
        lastError: null,
        retryCount: 0,
        canRetry: false,
      }));

      return result;
    } catch (handledError) {
      setGlobalState(prev => ({
        ...prev,
        lastError: handledError as AppError,
        retryCount: prev.retryCount + 1,
      }));

      throw handledError;
    }
  }, []);

  const retry = useCallback(async (operation: () => Promise<any>) => {
    if (!globalState.lastError) {
      return;
    }

    switch (globalState.lastError.type) {
      case ErrorType.AUTHENTICATION_ERROR:
        return authErrorHandling.retry(operation);
      case ErrorType.NETWORK_ERROR:
        return networkErrorHandling.retry(operation);
      case ErrorType.DIFY_API_ERROR:
        return difyErrorHandling.retry(operation);
      default:
        throw new Error('Cannot retry this type of error');
    }
  }, [globalState.lastError, authErrorHandling, networkErrorHandling, difyErrorHandling]);

  const clearError = useCallback(() => {
    setGlobalState({
      isRetrying: false,
      retryCount: 0,
      lastError: null,
      canRetry: false,
    });
  }, []);

  return {
    // Global state
    ...globalState,
    isRetrying: globalState.isRetrying || 
                authErrorHandling.isRetrying || 
                networkErrorHandling.isRetrying || 
                difyErrorHandling.isRetrying,
    
    // Handlers
    handleError,
    handleAuthError: authErrorHandling.handleAuthError,
    handleAuthzError: authzErrorHandling.handleAuthzError,
    handleNetworkError: networkErrorHandling.handleNetworkError,
    handleDifyError: difyErrorHandling.handleDifyError,
    
    // Utilities
    retry,
    clearError,
    
    // Individual error states
    authError: authErrorHandling.lastError,
    authzError: authzErrorHandling.lastError,
    networkError: networkErrorHandling.lastError,
    difyError: difyErrorHandling.lastError,
  };
};

/**
 * Hook for wrapping async operations with error handling
 */
export const useAsyncWithErrorHandling = <T>(
  asyncFunction: (...args: any[]) => Promise<T>,
  options: ErrorHandlingOptions & {
    errorContext?: any;
  } = {}
) => {
  const errorHandling = useUnifiedErrorHandling(options);
  const [isLoading, setIsLoading] = useState(false);
  const operationRef = useRef<(...args: any[]) => Promise<T>>(null as any);

  const execute = useCallback(async (...args: any[]): Promise<T> => {
    setIsLoading(true);
    operationRef.current = () => asyncFunction(...args);

    try {
      const result = await asyncFunction(...args);
      setIsLoading(false);
      return result;
    } catch (error) {
      setIsLoading(false);
      
      if (error instanceof Error) {
        // Convert to AppError if needed
        const appError = error as unknown as AppError;
        return errorHandling.handleError(
          appError,
          operationRef.current!,
          options.errorContext
        );
      }
      
      throw error;
    }
  }, [asyncFunction, errorHandling, options.errorContext]);

  const retry = useCallback(async (): Promise<T | undefined> => {
    if (!operationRef.current) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await errorHandling.retry(operationRef.current);
      setIsLoading(false);
      return result;
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  }, [errorHandling]);

  return {
    execute,
    retry,
    isLoading: isLoading || errorHandling.isRetrying,
    error: errorHandling.lastError,
    canRetry: errorHandling.canRetry,
    clearError: errorHandling.clearError,
  };
};