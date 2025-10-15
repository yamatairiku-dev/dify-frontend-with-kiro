import { QueryClient } from '@tanstack/react-query';

// React Query configuration optimized for performance
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes by default
      staleTime: 5 * 60 * 1000,
      // Keep data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Retry failed requests up to 3 times
      retry: 3,
      // Retry with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Refetch on window focus for critical data
      refetchOnWindowFocus: true,
      // Don't refetch on reconnect by default (can be overridden per query)
      refetchOnReconnect: 'always',
      // Background refetch interval (disabled by default, can be enabled per query)
      refetchInterval: false,
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
      // Retry delay for mutations
      retryDelay: 1000,
    },
  },
});

// Query keys factory for consistent cache management
export const queryKeys = {
  // Authentication related queries
  auth: {
    user: ['auth', 'user'] as const,
    session: ['auth', 'session'] as const,
  },
  // Workflow related queries
  workflows: {
    all: ['workflows'] as const,
    list: (filters?: Record<string, any>) => ['workflows', 'list', filters] as const,
    detail: (id: string) => ['workflows', 'detail', id] as const,
    execution: (id: string) => ['workflows', 'execution', id] as const,
    metadata: (id: string) => ['workflows', 'metadata', id] as const,
  },
  // Access control related queries
  permissions: {
    user: (userId: string) => ['permissions', 'user', userId] as const,
    workflows: (userId: string) => ['permissions', 'workflows', userId] as const,
  },
} as const;

// Cache invalidation helpers
export const invalidateQueries = {
  // Invalidate all workflow-related queries
  workflows: () => queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all }),
  // Invalidate specific workflow
  workflow: (id: string) => queryClient.invalidateQueries({ queryKey: queryKeys.workflows.detail(id) }),
  // Invalidate user permissions
  permissions: (userId: string) => queryClient.invalidateQueries({ queryKey: queryKeys.permissions.user(userId) }),
  // Invalidate all auth-related queries
  auth: () => queryClient.invalidateQueries({ queryKey: queryKeys.auth.user }),
};

// Prefetch helpers for route-based preloading
export const prefetchQueries = {
  // Prefetch workflows list
  workflowsList: async (filters?: Record<string, any>) => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.workflows.list(filters),
      queryFn: async () => {
        // This will be implemented in the hooks
        const { difyApiClient } = await import('../services/difyApiClient');
        return difyApiClient.getWorkflows(filters);
      },
      staleTime: 2 * 60 * 1000, // 2 minutes for prefetched data
    });
  },
  // Prefetch workflow detail
  workflowDetail: async (id: string) => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.workflows.detail(id),
      queryFn: async () => {
        const { difyApiClient } = await import('../services/difyApiClient');
        return difyApiClient.getWorkflowMetadata(id);
      },
      staleTime: 5 * 60 * 1000, // 5 minutes for workflow metadata
    });
  },
};

// Performance monitoring helpers
export const performanceHelpers = {
  // Get cache statistics
  getCacheStats: () => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    return {
      totalQueries: queries.length,
      activeQueries: queries.filter(q => q.getObserversCount() > 0).length,
      staleQueries: queries.filter(q => q.isStale()).length,
      cacheSize: queries.reduce((size, query) => {
        const data = query.state.data;
        return size + (data ? JSON.stringify(data).length : 0);
      }, 0),
    };
  },
  
  // Clear old cache entries
  clearStaleCache: () => {
    queryClient.getQueryCache().clear();
  },
  
  // Get query performance metrics
  getQueryMetrics: (queryKey: readonly unknown[]) => {
    const query = queryClient.getQueryCache().find({ queryKey });
    if (!query) return null;
    
    return {
      lastFetched: query.state.dataUpdatedAt,
      isStale: query.isStale(),
      isFetching: query.state.fetchStatus === 'fetching',
      errorCount: query.state.errorUpdateCount,
      successCount: query.state.dataUpdateCount,
    };
  },
};