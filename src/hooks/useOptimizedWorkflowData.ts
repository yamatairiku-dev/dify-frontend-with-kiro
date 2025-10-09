import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { difyApiClient } from '../services/difyApiClient';
import { accessControlService } from '../services/accessControlService';
import { queryKeys, invalidateQueries } from '../config/react-query';
import type { DifyWorkflow, WorkflowInput, WorkflowResult, GetWorkflowsRequest } from '../types/dify';

// Optimized workflow list hook with React Query
export const useOptimizedWorkflowList = (request?: GetWorkflowsRequest) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.workflows.list(request),
    queryFn: async (): Promise<DifyWorkflow[]> => {
      if (!user) throw new Error('User not authenticated');
      
      // Fetch workflows from API
      const workflows = await difyApiClient.getWorkflows(request);
      
      // Filter based on user permissions
      return workflows.filter(workflow => {
        const accessResult = accessControlService.checkAccess(
          user,
          `workflow:${workflow.id}`,
          'read'
        );
        return accessResult.allowed;
      });
    },
    enabled: !!user,
    staleTime: 3 * 60 * 1000, // 3 minutes - workflows don't change frequently
    gcTime: 10 * 60 * 1000, // 10 minutes in cache
    refetchOnWindowFocus: false, // Don't refetch on focus for workflow list
    select: (data) => {
      // Additional client-side filtering/sorting if needed
      if (request?.category) {
        return data.filter(w => w.category === request.category);
      }
      return data;
    },
  });
};

// Optimized single workflow hook
export const useOptimizedWorkflow = (workflowId: string) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.workflows.detail(workflowId),
    queryFn: async (): Promise<DifyWorkflow> => {
      if (!user) throw new Error('User not authenticated');
      
      const workflow = await difyApiClient.getWorkflowMetadata(workflowId);
      
      // Check access permissions
      const accessResult = accessControlService.checkAccess(
        user,
        `workflow:${workflowId}`,
        'read'
      );
      
      if (!accessResult.allowed) {
        throw new Error(`Access denied: ${accessResult.reason}`);
      }
      
      return workflow;
    },
    enabled: !!user && !!workflowId,
    staleTime: 5 * 60 * 1000, // 5 minutes - workflow metadata is relatively stable
    gcTime: 15 * 60 * 1000, // 15 minutes in cache
  });
};

// Optimized workflow execution hook
export const useOptimizedWorkflowExecution = (workflowId: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const executionMutation = useMutation({
    mutationFn: async (input: WorkflowInput): Promise<WorkflowResult> => {
      if (!user) throw new Error('User not authenticated');
      
      // Check execution permissions
      const accessResult = accessControlService.checkAccess(
        user,
        `workflow:${workflowId}`,
        'execute'
      );
      
      if (!accessResult.allowed) {
        throw new Error(`Execution access denied: ${accessResult.reason}`);
      }
      
      return await difyApiClient.executeWorkflow(workflowId, input, user.id);
    },
    onSuccess: (result) => {
      // Update the execution cache
      queryClient.setQueryData(
        queryKeys.workflows.execution(result.executionId),
        result
      );
      
      // Optionally invalidate related queries
      if (result.status === 'completed') {
        // Don't invalidate workflow list as it doesn't change
        // Only invalidate if we track execution history
      }
    },
    onError: (error) => {
      console.error('Workflow execution failed:', error);
    },
  });
  
  return {
    execute: executionMutation.mutate,
    executeAsync: executionMutation.mutateAsync,
    isExecuting: executionMutation.isPending,
    executionError: executionMutation.error,
    executionResult: executionMutation.data,
    reset: executionMutation.reset,
  };
};

// Hook for workflow execution status tracking
export const useWorkflowExecutionStatus = (executionId: string | null) => {
  return useQuery({
    queryKey: queryKeys.workflows.execution(executionId || ''),
    queryFn: async (): Promise<WorkflowResult> => {
      if (!executionId) throw new Error('No execution ID provided');
      return await difyApiClient.getWorkflowStatus(executionId);
    },
    enabled: !!executionId,
    refetchInterval: (query) => {
      // Poll every 2 seconds if execution is in progress
      const data = query.state.data;
      if (data?.status === 'running' || data?.status === 'pending') {
        return 2000;
      }
      // Stop polling if completed, failed, or cancelled
      return false;
    },
    staleTime: 0, // Always consider execution status stale
    gcTime: 5 * 60 * 1000, // Keep completed executions for 5 minutes
  });
};

// Optimized parallel data loading for workflow pages
export const useOptimizedParallelWorkflowData = (workflowId: string) => {
  const workflowQuery = useOptimizedWorkflow(workflowId);
  const workflowListQuery = useOptimizedWorkflowList();
  const executionHook = useOptimizedWorkflowExecution(workflowId);
  
  return {
    // Workflow data
    workflow: {
      data: workflowQuery.data,
      loading: workflowQuery.isLoading,
      error: workflowQuery.error,
      refetch: workflowQuery.refetch,
    },
    
    // Workflow list (for navigation/context)
    workflowList: {
      data: workflowListQuery.data,
      loading: workflowListQuery.isLoading,
      error: workflowListQuery.error,
      refetch: workflowListQuery.refetch,
    },
    
    // Execution capabilities
    execution: executionHook,
    
    // Combined loading state
    isLoading: workflowQuery.isLoading || workflowListQuery.isLoading,
    
    // Combined error state
    error: workflowQuery.error || workflowListQuery.error,
    
    // Ready state (all required data loaded)
    isReady: !workflowQuery.isLoading && !workflowQuery.error && !!workflowQuery.data,
  };
};

// Hook for prefetching workflow data (for route preloading)
export const useWorkflowPrefetch = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const prefetchWorkflow = async (workflowId: string) => {
    if (!user) return;
    
    await queryClient.prefetchQuery({
      queryKey: queryKeys.workflows.detail(workflowId),
      queryFn: async () => {
        const workflow = await difyApiClient.getWorkflowMetadata(workflowId);
        
        // Check access permissions
        const accessResult = accessControlService.checkAccess(
          user,
          `workflow:${workflowId}`,
          'read'
        );
        
        if (!accessResult.allowed) {
          throw new Error(`Access denied: ${accessResult.reason}`);
        }
        
        return workflow;
      },
      staleTime: 2 * 60 * 1000, // 2 minutes for prefetched data
    });
  };
  
  const prefetchWorkflowList = async (request?: GetWorkflowsRequest) => {
    if (!user) return;
    
    await queryClient.prefetchQuery({
      queryKey: queryKeys.workflows.list(request),
      queryFn: async () => {
        const workflows = await difyApiClient.getWorkflows(request);
        
        return workflows.filter(workflow => {
          const accessResult = accessControlService.checkAccess(
            user,
            `workflow:${workflow.id}`,
            'read'
          );
          return accessResult.allowed;
        });
      },
      staleTime: 2 * 60 * 1000,
    });
  };
  
  return {
    prefetchWorkflow,
    prefetchWorkflowList,
  };
};

// Cache management hooks
export const useWorkflowCacheManagement = () => {
  const queryClient = useQueryClient();
  
  return {
    // Invalidate all workflow queries
    invalidateAllWorkflows: () => invalidateQueries.workflows(),
    
    // Invalidate specific workflow
    invalidateWorkflow: (id: string) => invalidateQueries.workflow(id),
    
    // Clear workflow cache
    clearWorkflowCache: () => {
      queryClient.removeQueries({ queryKey: queryKeys.workflows.all });
    },
    
    // Get cached workflow data without triggering a fetch
    getCachedWorkflow: (id: string) => {
      return queryClient.getQueryData(queryKeys.workflows.detail(id));
    },
    
    // Set workflow data in cache
    setCachedWorkflow: (id: string, data: DifyWorkflow) => {
      queryClient.setQueryData(queryKeys.workflows.detail(id), data);
    },
  };
};