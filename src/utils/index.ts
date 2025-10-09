// Utility exports
export * from './oauth-redirect';
export * from './errorUtils';

// Error handling integration utilities
export {
  fetchWithErrorHandling,
  authOperationWithErrorHandling,
  authorizationCheckWithErrorHandling,
  difyApiOperationWithErrorHandling,
  withErrorHandling,
  withMethodErrorHandling,
  createErrorHandledService,
  useErrorHandledCallback,
  withPromiseErrorHandling,
  isAuthenticationError,
  isAuthorizationError,
  isNetworkError,
  isDifyApiError,
} from './errorHandlingIntegration';

// Route preloading and performance utilities
export {
  RoutePreloader,
  useRoutePreloading,
  createPreloadLink,
  PreloadPerformanceMonitor,
  IntersectionPreloader,
} from './routePreloading';