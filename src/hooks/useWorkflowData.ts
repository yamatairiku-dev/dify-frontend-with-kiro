import { useState, useEffect, useCallback, useRef } from 'react';
import { difyApiClient } from '../services/difyApiClient';
import { accessControlService } from '../services/accessControlService';
import { useAuth } from '../context/AuthContext';
import type {
  DifyWorkflow,
  GetWorkflowsRequest,
  WorkflowInput,
  WorkflowResult,
  DifyApiError,
} from '../types/dify';

/**
 * Custom hook for fetching workflow data with loading states and error handling
 * Implements SPA mode data loading patterns for React Router v7
 */

// Base data loading state interface
export interface DataLoadingState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Workflow list hook state
export interface WorkflowListState extends DataLoadingState<DifyWorkflow[]> {
  filteredWorkflows: DifyWorkflow[];
  totalCount: number;
}

// Single workflow hook state
export interface WorkflowState extends DataLoadingState<DifyWorkflow> {
  canExecute: boolean;
  requiredPermissions: string[];
}

// Workflow execution state
export interface WorkflowExecutionState {
  isExecuting: boolean;
  result: WorkflowResult | null;
  error: string | null;
  progress: number;
  execute: (input: WorkflowInput) => Promise<WorkflowResult | null>;
  cancel: () => Promise<boolean>;
  reset: () => void;
}

/**
 * Hook for fetching and managing workflow list data
 */
export function useWorkflowList(request?: GetWorkflowsRequest): WorkflowListState {
  const { user } = useAuth();
  const [data, setData] = useState<DifyWorkflow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchWorkflows = useCallback(async () => {
    if (!user) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError(null);

    try {
      // Fetch workflows from Dify API
      const workflows = await difyApiClient.getWorkflows(request);
      
      // Filter workflows based on user permissions
      const accessibleWorkflows = workflows.filter(workflow => {
        const accessResult = accessControlService.checkAccess(
          user,
          `workflow:${workflow.id}`,
          'read'
        );
        return accessResult.allowed;
      });

      setData(accessibleWorkflows);
      setTotalCount(accessibleWorkflows.length);
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled, don't update state
        return;
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch workflows';
      setError(errorMessage);
      setData(null);
      setTotalCount(0);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [user, request]);

  const refetch = useCallback(async () => {
    await fetchWorkflows();
  }, [fetchWorkflows]);

  // Filter workflows based on user permissions (computed property)
  const filteredWorkflows = data?.filter(workflow => {
    if (!user) return false;
    
    const accessResult = accessControlService.checkAccess(
      user,
      `workflow:${workflow.id}`,
      'execute'
    );
    return accessResult.allowed;
  }) || [];

  useEffect(() => {
    fetchWorkflows();

    // Cleanup function to cancel pending requests
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchWorkflows]);

  return {
    data,
    loading,
    error,
    refetch,
    filteredWorkflows,
    totalCount,
  };
}

/**
 * Hook for fetching single workflow data with permission checking
 */
export function useWorkflow(workflowId: string): WorkflowState {
  const { user } = useAuth();
  const [data, setData] = useState<DifyWorkflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchWorkflow = useCallback(async () => {
    if (!workflowId) {
      setError('Workflow ID is required');
      setLoading(false);
      return;
    }

    if (!user) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError(null);

    try {
      // Check read permission first
      const readAccess = accessControlService.checkAccess(
        user,
        `workflow:${workflowId}`,
        'read'
      );

      if (!readAccess.allowed) {
        throw new Error(`Access denied: ${readAccess.reason}`);
      }

      // Fetch workflow metadata
      const workflow = await difyApiClient.getWorkflowMetadata(workflowId);
      setData(workflow);
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled, don't update state
        return;
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch workflow';
      setError(errorMessage);
      setData(null);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [workflowId, user]);

  const refetch = useCallback(async () => {
    await fetchWorkflow();
  }, [fetchWorkflow]);

  // Check execution permission
  const canExecute = user && data ? 
    accessControlService.checkAccess(user, `workflow:${workflowId}`, 'execute').allowed : 
    false;

  // Get required permissions for this workflow
  const requiredPermissions = data?.requiredPermissions || [];

  useEffect(() => {
    fetchWorkflow();

    // Cleanup function to cancel pending requests
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchWorkflow]);

  return {
    data,
    loading,
    error,
    refetch,
    canExecute,
    requiredPermissions,
  };
}

/**
 * Hook for workflow execution with progress tracking
 */
export function useWorkflowExecution(workflowId: string): WorkflowExecutionState {
  const { user } = useAuth();
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const executionIdRef = useRef<string | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const execute = useCallback(async (input: WorkflowInput): Promise<WorkflowResult | null> => {
    if (!user) {
      setError('User not authenticated');
      return null;
    }

    if (isExecuting) {
      setError('Workflow is already executing');
      return null;
    }

    // Check execution permission
    const executeAccess = accessControlService.checkAccess(
      user,
      `workflow:${workflowId}`,
      'execute'
    );

    if (!executeAccess.allowed) {
      setError(`Access denied: ${executeAccess.reason}`);
      return null;
    }

    setIsExecuting(true);
    setError(null);
    setResult(null);
    setProgress(0);

    try {
      // Start workflow execution
      const executionResult = await difyApiClient.executeWorkflow(
        workflowId,
        input,
        user.id
      );

      executionIdRef.current = executionResult.executionId;
      setProgress(10); // Initial progress

      // Start progress monitoring
      progressIntervalRef.current = setInterval(async () => {
        try {
          if (!executionIdRef.current) return;

          const status = await difyApiClient.getWorkflowStatus(executionIdRef.current);
          
          // Update progress based on status
          switch (status.status) {
            case 'pending':
              setProgress(prev => Math.min(prev + 5, 20));
              break;
            case 'running':
              setProgress(prev => Math.min(prev + 10, 80));
              break;
            case 'completed':
            case 'failed':
            case 'cancelled':
              setProgress(100);
              setResult(status);
              setIsExecuting(false);
              
              if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
              }
              
              if (status.status === 'failed') {
                setError(status.error || 'Workflow execution failed');
              }
              break;
          }
        } catch (err) {
          console.error('Error monitoring workflow progress:', err);
          // Don't stop execution for monitoring errors
        }
      }, 2000);

      return executionResult;
    } catch (err) {
      setIsExecuting(false);
      setProgress(0);
      
      const errorMessage = err instanceof Error ? err.message : 'Workflow execution failed';
      setError(errorMessage);
      
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      
      return null;
    }
  }, [workflowId, user, isExecuting]);

  const cancel = useCallback(async (): Promise<boolean> => {
    if (!executionIdRef.current || !isExecuting) {
      return false;
    }

    try {
      const cancelled = await difyApiClient.cancelWorkflowExecution(executionIdRef.current);
      
      if (cancelled) {
        setIsExecuting(false);
        setProgress(100);
        setError('Workflow execution was cancelled');
        
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      }
      
      return cancelled;
    } catch (err) {
      console.error('Error cancelling workflow:', err);
      return false;
    }
  }, [isExecuting]);

  const reset = useCallback(() => {
    setIsExecuting(false);
    setResult(null);
    setError(null);
    setProgress(0);
    executionIdRef.current = null;
    
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  return {
    isExecuting,
    result,
    error,
    progress,
    execute,
    cancel,
    reset,
  };
}

/**
 * Hook for parallel data loading - loads multiple data sources concurrently
 */
export function useParallelWorkflowData(workflowId: string) {
  const workflowState = useWorkflow(workflowId);
  const workflowListState = useWorkflowList();
  const executionState = useWorkflowExecution(workflowId);

  // Combined loading state - true if any data source is loading
  const isLoading = workflowState.loading || workflowListState.loading;
  
  // Combined error state - returns first error encountered
  const error = workflowState.error || workflowListState.error || executionState.error;
  
  // Check if all data has been loaded successfully
  const isReady = !isLoading && !error && workflowState.data !== null;

  // Refetch all data sources
  const refetchAll = useCallback(async () => {
    await Promise.all([
      workflowState.refetch(),
      workflowListState.refetch(),
    ]);
  }, [workflowState, workflowListState]);

  return {
    workflow: workflowState,
    workflowList: workflowListState,
    execution: executionState,
    isLoading,
    error,
    isReady,
    refetchAll,
  };
}