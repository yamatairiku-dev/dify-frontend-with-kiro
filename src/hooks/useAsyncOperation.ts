import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook for managing async operations with loading states and error handling
 * Provides a consistent pattern for SPA mode data operations
 */

// Async operation state
export interface AsyncOperationState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  success: boolean;
}

// Async operation options
export interface AsyncOperationOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
}

// Hook return type
export interface UseAsyncOperationReturn<T> extends AsyncOperationState<T> {
  execute: (...args: any[]) => Promise<T | null>;
  reset: () => void;
  retry: () => Promise<T | null>;
  cancel: () => void;
}

/**
 * Hook for managing single async operations
 */
export function useAsyncOperation<T>(
  asyncFunction: (...args: any[]) => Promise<T>,
  options: AsyncOperationOptions = {}
): UseAsyncOperationReturn<T> {
  const [state, setState] = useState<AsyncOperationState<T>>({
    data: null,
    loading: false,
    error: null,
    success: false,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastArgsRef = useRef<any[]>([]);
  const retryCountRef = useRef(0);

  const {
    onSuccess,
    onError,
    retryAttempts = 0,
    retryDelay = 1000,
    timeout = 30000,
  } = options;

  const execute = useCallback(async (...args: any[]): Promise<T | null> => {
    // Cancel previous operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const currentController = new AbortController();
    abortControllerRef.current = currentController;
    lastArgsRef.current = args;
    retryCountRef.current = 0;

    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      success: false,
    }));

    try {
      // Set up timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Request timeout'));
        }, timeout);
      });

      const result = await Promise.race([
        asyncFunction(...args),
        timeoutPromise
      ]);

      // Check if this specific operation was cancelled
      if (currentController.signal.aborted) {
        return null;
      }

      setState({
        data: result,
        loading: false,
        error: null,
        success: true,
      });

      onSuccess?.(result);
      return result;
    } catch (error) {
      // Check if this specific operation was cancelled
      if (currentController.signal.aborted) {
        return null;
      }

      const errorMessage = error instanceof Error ? error.message : 'Operation failed';
      
      setState({
        data: null,
        loading: false,
        error: errorMessage,
        success: false,
      });

      onError?.(error instanceof Error ? error : new Error(errorMessage));
      return null;
    } finally {
      // Only clear if this is still the current controller
      if (abortControllerRef.current === currentController) {
        abortControllerRef.current = null;
      }
    }
  }, [asyncFunction, onSuccess, onError, timeout]);

  const retry = useCallback(async (): Promise<T | null> => {
    if (retryCountRef.current >= retryAttempts) {
      return null;
    }

    retryCountRef.current++;
    
    // Wait for retry delay
    if (retryDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, retryDelay * retryCountRef.current));
    }

    return execute(...lastArgsRef.current);
  }, [execute, retryAttempts, retryDelay]);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setState({
      data: null,
      loading: false,
      error: null,
      success: false,
    });

    retryCountRef.current = 0;
    lastArgsRef.current = [];
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setState(prev => ({
      ...prev,
      loading: false,
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    execute,
    reset,
    retry,
    cancel,
  };
}

/**
 * Hook for managing multiple parallel async operations
 */
export function useParallelAsyncOperations<T>(
  operations: Array<{
    key: string;
    asyncFunction: (...args: any[]) => Promise<T>;
    options?: AsyncOperationOptions;
  }>
) {
  const [states, setStates] = useState<Record<string, AsyncOperationState<T>>>(() => {
    const initialStates: Record<string, AsyncOperationState<T>> = {};
    operations.forEach(op => {
      initialStates[op.key] = {
        data: null,
        loading: false,
        error: null,
        success: false,
      };
    });
    return initialStates;
  });

  const abortControllersRef = useRef<Record<string, AbortController>>({});

  const executeAll = useCallback(async (
    args: Record<string, any[]> = {}
  ): Promise<Record<string, T | null>> => {
    // Cancel all previous operations
    Object.values(abortControllersRef.current).forEach(controller => {
      controller.abort();
    });

    // Initialize new abort controllers
    const newControllers: Record<string, AbortController> = {};
    operations.forEach(op => {
      newControllers[op.key] = new AbortController();
    });
    abortControllersRef.current = newControllers;

    // Set all operations to loading
    setStates(prev => {
      const newStates = { ...prev };
      operations.forEach(op => {
        newStates[op.key] = {
          ...newStates[op.key],
          loading: true,
          error: null,
          success: false,
        };
      });
      return newStates;
    });

    // Execute all operations in parallel
    const promises = operations.map(async (op) => {
      try {
        const operationArgs = args[op.key] || [];
        const result = await op.asyncFunction(...operationArgs);

        // Check if cancelled
        if (abortControllersRef.current[op.key]?.signal.aborted) {
          return { key: op.key, result: null, error: null };
        }

        setStates(prev => ({
          ...prev,
          [op.key]: {
            data: result,
            loading: false,
            error: null,
            success: true,
          },
        }));

        op.options?.onSuccess?.(result);
        return { key: op.key, result, error: null };
      } catch (error) {
        // Check if cancelled
        if (abortControllersRef.current[op.key]?.signal.aborted) {
          return { key: op.key, result: null, error: null };
        }

        const errorMessage = error instanceof Error ? error.message : 'Operation failed';
        
        setStates(prev => ({
          ...prev,
          [op.key]: {
            data: null,
            loading: false,
            error: errorMessage,
            success: false,
          },
        }));

        op.options?.onError?.(error instanceof Error ? error : new Error(errorMessage));
        return { key: op.key, result: null, error: errorMessage };
      }
    });

    const results = await Promise.all(promises);
    
    // Convert results to record format
    const resultRecord: Record<string, T | null> = {};
    results.forEach(({ key, result }) => {
      resultRecord[key] = result;
    });

    return resultRecord;
  }, [operations]);

  const executeOne = useCallback(async (
    key: string,
    ...args: any[]
  ): Promise<T | null> => {
    const operation = operations.find(op => op.key === key);
    if (!operation) {
      throw new Error(`Operation with key "${key}" not found`);
    }

    // Cancel previous operation for this key
    if (abortControllersRef.current[key]) {
      abortControllersRef.current[key].abort();
    }

    abortControllersRef.current[key] = new AbortController();

    setStates(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        loading: true,
        error: null,
        success: false,
      },
    }));

    try {
      const result = await operation.asyncFunction(...args);

      // Check if cancelled
      if (abortControllersRef.current[key]?.signal.aborted) {
        return null;
      }

      setStates(prev => ({
        ...prev,
        [key]: {
          data: result,
          loading: false,
          error: null,
          success: true,
        },
      }));

      operation.options?.onSuccess?.(result);
      return result;
    } catch (error) {
      // Check if cancelled
      if (abortControllersRef.current[key]?.signal.aborted) {
        return null;
      }

      const errorMessage = error instanceof Error ? error.message : 'Operation failed';
      
      setStates(prev => ({
        ...prev,
        [key]: {
          data: null,
          loading: false,
          error: errorMessage,
          success: false,
        },
      }));

      operation.options?.onError?.(error instanceof Error ? error : new Error(errorMessage));
      return null;
    }
  }, [operations]);

  const cancelAll = useCallback(() => {
    Object.values(abortControllersRef.current).forEach(controller => {
      controller.abort();
    });

    setStates(prev => {
      const newStates = { ...prev };
      Object.keys(newStates).forEach(key => {
        newStates[key] = {
          ...newStates[key],
          loading: false,
        };
      });
      return newStates;
    });
  }, []);

  const cancelOne = useCallback((key: string) => {
    if (abortControllersRef.current[key]) {
      abortControllersRef.current[key].abort();
    }

    setStates(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        loading: false,
      },
    }));
  }, []);

  const resetAll = useCallback(() => {
    cancelAll();
    
    setStates(() => {
      const resetStates: Record<string, AsyncOperationState<T>> = {};
      operations.forEach(op => {
        resetStates[op.key] = {
          data: null,
          loading: false,
          error: null,
          success: false,
        };
      });
      return resetStates;
    });
  }, [operations, cancelAll]);

  // Computed properties
  const isAnyLoading = Object.values(states).some(state => state.loading);
  const isAllLoading = Object.values(states).every(state => state.loading);
  const hasAnyError = Object.values(states).some(state => state.error !== null);
  const isAllSuccess = Object.values(states).every(state => state.success);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(abortControllersRef.current).forEach(controller => {
        controller.abort();
      });
    };
  }, []);

  return {
    states,
    executeAll,
    executeOne,
    cancelAll,
    cancelOne,
    resetAll,
    isAnyLoading,
    isAllLoading,
    hasAnyError,
    isAllSuccess,
  };
}

/**
 * Hook for sequential async operations (one after another)
 */
export function useSequentialAsyncOperations<T>(
  operations: Array<{
    key: string;
    asyncFunction: (...args: any[]) => Promise<T>;
    options?: AsyncOperationOptions;
  }>
) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<Array<T | null>>([]);
  const [overallState, setOverallState] = useState<AsyncOperationState<T[]>>({
    data: null,
    loading: false,
    error: null,
    success: false,
  });

  const executeSequentially = useCallback(async (
    args: Array<any[]> = []
  ): Promise<Array<T | null>> => {
    setOverallState({
      data: null,
      loading: true,
      error: null,
      success: false,
    });

    setResults([]);
    setCurrentIndex(0);

    const sequentialResults: Array<T | null> = [];

    try {
      for (let i = 0; i < operations.length; i++) {
        setCurrentIndex(i);
        
        const operation = operations[i];
        const operationArgs = args[i] || [];
        
        try {
          const result = await operation.asyncFunction(...operationArgs);
          sequentialResults.push(result);
          setResults([...sequentialResults]);
          
          operation.options?.onSuccess?.(result);
        } catch (error) {
          sequentialResults.push(null);
          setResults([...sequentialResults]);
          
          operation.options?.onError?.(error instanceof Error ? error : new Error('Operation failed'));
          
          // Stop execution on error (can be made configurable)
          throw error;
        }
      }

      setOverallState({
        data: sequentialResults as T[],
        loading: false,
        error: null,
        success: true,
      });

      return sequentialResults;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sequential operation failed';
      
      setOverallState({
        data: null,
        loading: false,
        error: errorMessage,
        success: false,
      });

      return sequentialResults;
    }
  }, [operations]);

  const reset = useCallback(() => {
    setCurrentIndex(0);
    setResults([]);
    setOverallState({
      data: null,
      loading: false,
      error: null,
      success: false,
    });
  }, []);

  return {
    ...overallState,
    currentIndex,
    results,
    executeSequentially,
    reset,
    progress: operations.length > 0 ? ((currentIndex + (overallState.success ? 1 : 0)) / operations.length) * 100 : 0,
  };
}