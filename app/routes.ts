import type { RouteConfig } from '@react-router/dev/routes';

export default [
  // Public routes
  {
    path: '/login',
    file: 'routes/login.tsx',
  },
  {
    path: '/callback/:provider',
    file: 'routes/callback.$provider.tsx',
  },
  
  // Protected routes - main dashboard
  {
    path: '/',
    file: 'routes/_index.tsx',
  },
  
  // Protected routes - workflows
  {
    path: '/workflows',
    file: 'routes/workflows._index.tsx',
  },
  {
    path: '/workflows/:id',
    file: 'routes/workflows.$id.tsx',
  },
  
  // Error and access denied pages
  {
    path: '/access-denied',
    file: 'routes/access-denied.tsx',
  },
] satisfies RouteConfig;
