import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { 
  useAsyncOperation, 
  useParallelAsyncOperations, 
  useSequentialAsyncOperations 
} from '../useAsyncOperation';

describe('useAsyncOperation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle successful async operation', async () => {
    const mockAsyncFunction = jest.fn().mockResolvedValue('success result');
    const mockOnSuccess = jest.fn();
    
    const { result } = renderHook(() => 
      useAsyncOperation(mockAsyncFunction, { onSuccess: mockOnSuccess })
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);
    expect(result.current.success).toBe(false);

    await act(async () => {
      const execResult = await result.current.execute('test-arg');
      expect(execResult).toBe('success result');
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe('success result');
    expect(result.current.error).toBe(null);
    expect(result.current.success).toBe(true);
    expect(mockAsyncFunction).toHaveBeenCalledWith('test-arg');
    expect(mockOnSuccess).toHaveBeenCalledWith('success result');
  });

  it('should handle async operation errors', async () => {
    const errorMessage = 'Operation failed';
    const mockAsyncFunction = jest.fn().mockRejectedValue(new Error(errorMessage));
    const mockOnError = jest.fn();
    
    const { result } = renderHook(() => 
      useAsyncOperation(mockAsyncFunction, { onError: mockOnError })
    );

    await act(async () => {
      const execResult = await result.current.execute('test-arg');
      expect(execResult).toBe(null);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(errorMessage);
    expect(result.current.success).toBe(false);
    expect(mockOnError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('should handle loading states correctly', async () => {
    let resolvePromise: (value: string) => void;
    const mockAsyncFunction = jest.fn().mockImplementation(() => 
      new Promise<string>((resolve) => {
        resolvePromise = resolve;
      })
    );
    
    const { result } = renderHook(() => useAsyncOperation(mockAsyncFunction));

    // Start execution
    act(() => {
      result.current.execute('test-arg');
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);

    // Resolve the promise
    await act(async () => {
      resolvePromise!('success');
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe('success');
  });

  it('should support cancellation', async () => {
    let resolvePromise: (value: string) => void;
    const mockAsyncFunction = jest.fn().mockImplementation(() => 
      new Promise<string>((resolve) => {
        resolvePromise = resolve;
      })
    );
    
    const { result } = renderHook(() => useAsyncOperation(mockAsyncFunction));

    // Start execution
    act(() => {
      result.current.execute('test-arg');
    });

    expect(result.current.loading).toBe(true);

    // Cancel operation
    act(() => {
      result.current.cancel();
    });

    expect(result.current.loading).toBe(false);

    // Resolve the promise (should not update state)
    await act(async () => {
      resolvePromise!('success');
    });

    expect(result.current.data).toBe(null);
  });

  it('should support reset functionality', async () => {
    const mockAsyncFunction = jest.fn().mockResolvedValue('success');
    
    const { result } = renderHook(() => useAsyncOperation(mockAsyncFunction));

    await act(async () => {
      await result.current.execute('test-arg');
    });

    expect(result.current.data).toBe('success');
    expect(result.current.success).toBe(true);

    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toBe(null);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.success).toBe(false);
  });

  it('should support retry functionality', async () => {
    const mockAsyncFunction = jest.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockResolvedValueOnce('success');
    
    const { result } = renderHook(() => 
      useAsyncOperation(mockAsyncFunction, { retryAttempts: 2, retryDelay: 10 })
    );

    // First execution fails
    await act(async () => {
      await result.current.execute('test-arg');
    });

    expect(result.current.error).toBe('First failure');

    // Retry should succeed
    await act(async () => {
      const retryResult = await result.current.retry();
      expect(retryResult).toBe('success');
    });

    expect(result.current.data).toBe('success');
    expect(result.current.error).toBe(null);
    expect(mockAsyncFunction).toHaveBeenCalledTimes(2);
  });

  it('should handle timeout', async () => {
    const mockAsyncFunction = jest.fn().mockImplementation(() => 
      new Promise((resolve) => setTimeout(resolve, 1000))
    );
    
    const { result } = renderHook(() => 
      useAsyncOperation(mockAsyncFunction, { timeout: 100 })
    );

    await act(async () => {
      await result.current.execute('test-arg');
    });

    expect(result.current.error).toBe('Request timeout');
  });

  it('should cancel previous operation when new one starts', async () => {
    let resolveFirst: (value: string) => void;
    let resolveSecond: (value: string) => void;
    
    const mockAsyncFunction = jest.fn()
      .mockImplementationOnce(() => new Promise<string>((resolve) => {
        resolveFirst = resolve;
      }))
      .mockImplementationOnce(() => new Promise<string>((resolve) => {
        resolveSecond = resolve;
      }));
    
    const { result } = renderHook(() => useAsyncOperation(mockAsyncFunction));

    // Start first operation
    act(() => {
      result.current.execute('first');
    });

    // Start second operation (should cancel first)
    act(() => {
      result.current.execute('second');
    });

    // Resolve first (should not update state)
    await act(async () => {
      resolveFirst!('first result');
    });

    expect(result.current.data).toBe(null);

    // Resolve second (should update state)
    await act(async () => {
      resolveSecond!('second result');
    });

    expect(result.current.data).toBe('second result');
  });
});

describe('useParallelAsyncOperations', () => {
  const operations = [
    {
      key: 'op1',
      asyncFunction: jest.fn(),
    },
    {
      key: 'op2',
      asyncFunction: jest.fn(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    operations[0].asyncFunction.mockResolvedValue('result1');
    operations[1].asyncFunction.mockResolvedValue('result2');
  });

  it('should execute all operations in parallel', async () => {
    const { result } = renderHook(() => useParallelAsyncOperations(operations));

    expect(result.current.isAnyLoading).toBe(false);
    expect(result.current.isAllSuccess).toBe(false);

    await act(async () => {
      const results = await result.current.executeAll({
        op1: ['arg1'],
        op2: ['arg2'],
      });
      
      expect(results).toEqual({
        op1: 'result1',
        op2: 'result2',
      });
    });

    expect(result.current.isAllSuccess).toBe(true);
    expect(result.current.hasAnyError).toBe(false);
    expect(operations[0].asyncFunction).toHaveBeenCalledWith('arg1');
    expect(operations[1].asyncFunction).toHaveBeenCalledWith('arg2');
  });

  it('should execute single operation', async () => {
    const { result } = renderHook(() => useParallelAsyncOperations(operations));

    await act(async () => {
      const execResult = await result.current.executeOne('op1', 'single-arg');
      expect(execResult).toBe('result1');
    });

    expect(result.current.states['op1'].success).toBe(true);
    expect(result.current.states['op1'].data).toBe('result1');
    expect(result.current.states['op2'].success).toBe(false);
  });

  it('should handle errors in parallel execution', async () => {
    operations[0].asyncFunction.mockRejectedValue(new Error('Operation 1 failed'));
    
    const { result } = renderHook(() => useParallelAsyncOperations(operations));

    await act(async () => {
      await result.current.executeAll();
    });

    expect(result.current.hasAnyError).toBe(true);
    expect(result.current.states['op1'].error).toBe('Operation 1 failed');
    expect(result.current.states['op2'].success).toBe(true);
  });

  it('should support cancellation', async () => {
    let resolveOp1: (value: string) => void;
    operations[0].asyncFunction.mockImplementation(() => 
      new Promise<string>((resolve) => {
        resolveOp1 = resolve;
      })
    );
    
    const { result } = renderHook(() => useParallelAsyncOperations(operations));

    // Start operations
    act(() => {
      result.current.executeAll();
    });

    expect(result.current.isAnyLoading).toBe(true);

    // Cancel all
    act(() => {
      result.current.cancelAll();
    });

    expect(result.current.isAnyLoading).toBe(false);

    // Resolve (should not update state)
    await act(async () => {
      resolveOp1!('result1');
    });

    expect(result.current.states['op1'].data).toBe(null);
  });

  it('should support reset functionality', async () => {
    const { result } = renderHook(() => useParallelAsyncOperations(operations));

    await act(async () => {
      await result.current.executeAll();
    });

    expect(result.current.isAllSuccess).toBe(true);

    act(() => {
      result.current.resetAll();
    });

    expect(result.current.isAllSuccess).toBe(false);
    expect(result.current.states['op1'].data).toBe(null);
    expect(result.current.states['op2'].data).toBe(null);
  });
});

describe('useSequentialAsyncOperations', () => {
  const operations = [
    {
      key: 'op1',
      asyncFunction: jest.fn(),
    },
    {
      key: 'op2',
      asyncFunction: jest.fn(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    operations[0].asyncFunction.mockResolvedValue('result1');
    operations[1].asyncFunction.mockResolvedValue('result2');
  });

  it('should execute operations sequentially', async () => {
    const { result } = renderHook(() => useSequentialAsyncOperations(operations));

    expect(result.current.loading).toBe(false);
    expect(result.current.currentIndex).toBe(0);

    await act(async () => {
      const results = await result.current.executeSequentially([
        ['arg1'],
        ['arg2'],
      ]);
      
      expect(results).toEqual(['result1', 'result2']);
    });

    expect(result.current.success).toBe(true);
    expect(result.current.data).toEqual(['result1', 'result2']);
    expect(result.current.progress).toBe(100);
  });

  it('should track progress during execution', async () => {
    let resolveOp1: (value: string) => void;
    let resolveOp2: (value: string) => void;
    
    operations[0].asyncFunction.mockImplementation(() => 
      new Promise<string>((resolve) => {
        resolveOp1 = resolve;
      })
    );
    operations[1].asyncFunction.mockImplementation(() => 
      new Promise<string>((resolve) => {
        resolveOp2 = resolve;
      })
    );
    
    const { result } = renderHook(() => useSequentialAsyncOperations(operations));

    // Start execution
    act(() => {
      result.current.executeSequentially();
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.progress).toBe(0);

    // Complete first operation
    await act(async () => {
      resolveOp1!('result1');
    });

    expect(result.current.currentIndex).toBe(1);
    expect(result.current.progress).toBe(50);
    expect(result.current.results).toEqual(['result1']);

    // Complete second operation
    await act(async () => {
      resolveOp2!('result2');
    });

    expect(result.current.progress).toBe(100);
    expect(result.current.success).toBe(true);
  });

  it('should stop on first error', async () => {
    operations[0].asyncFunction.mockRejectedValue(new Error('Operation 1 failed'));
    
    const { result } = renderHook(() => useSequentialAsyncOperations(operations));

    await act(async () => {
      const results = await result.current.executeSequentially();
      expect(results).toEqual([null]);
    });

    expect(result.current.error).toBe('Operation 1 failed');
    expect(result.current.success).toBe(false);
    expect(operations[1].asyncFunction).not.toHaveBeenCalled();
  });

  it('should support reset functionality', async () => {
    const { result } = renderHook(() => useSequentialAsyncOperations(operations));

    await act(async () => {
      await result.current.executeSequentially();
    });

    expect(result.current.success).toBe(true);

    act(() => {
      result.current.reset();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);
    expect(result.current.success).toBe(false);
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.results).toEqual([]);
    expect(result.current.progress).toBe(0);
  });
});