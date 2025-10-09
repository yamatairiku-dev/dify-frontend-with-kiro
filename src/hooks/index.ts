// Authentication and authorization hooks
export {
  useAuthRequired,
  usePermissionRequired,
  useAnyPermissionRequired,
  usePermissionCheck,
  useMultiplePermissionCheck,
  useRoleRequired
} from './useProtectedRoute';

// Data loading hooks for SPA mode
export {
  useWorkflowList,
  useWorkflow,
  useWorkflowExecution,
  useParallelWorkflowData
} from './useWorkflowData';

// Form handling hooks
export {
  useWorkflowForm,
  useMultipleWorkflowForms
} from './useWorkflowForm';

// Async operation hooks
export {
  useAsyncOperation,
  useParallelAsyncOperations,
  useSequentialAsyncOperations
} from './useAsyncOperation';

// Error handling hooks
export {
  useAuthenticationErrorHandling,
  useAuthorizationErrorHandling,
  useNetworkErrorHandling,
  useDifyApiErrorHandling,
  useUnifiedErrorHandling,
  useAsyncWithErrorHandling,
} from './useErrorHandling';

// Session security hooks
export {
  useSessionSecurity,
  useSessionTimeoutWarning,
  useIdleTimeout
} from './useSessionSecurity';

// Optimized React Query hooks
export {
  useOptimizedWorkflowList,
  useOptimizedWorkflow,
  useOptimizedWorkflowExecution,
  useWorkflowExecutionStatus,
  useOptimizedParallelWorkflowData,
  useWorkflowPrefetch,
  useWorkflowCacheManagement,
} from './useOptimizedWorkflowData';