import { defineConfig } from 'vite';
import { reactRouter } from '@react-router/dev/vite';
import { securityPlugin } from './src/plugins/vite-security-plugin';

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    reactRouter(),
    securityPlugin({
      enabled: mode === 'production',
      injectCSP: mode === 'production',
      injectSecurityHeaders: mode === 'production',
    }),
  ],
  server: {
    port: 5173,
    host: true,
    headers: {
      // Additional security headers for development
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  build: {
    target: 'es2022',
    sourcemap: mode === 'development',
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Ensure consistent chunk naming for CSP
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // Manual chunk splitting for better caching
        manualChunks: {
          // React and React Router in separate chunk
          'react-vendor': ['react', 'react-dom', 'react-router'],
          // React Query in separate chunk
          'query-vendor': ['@tanstack/react-query', '@tanstack/react-query-devtools'],
          // Authentication and security services
          'auth-services': [
            './src/context/AuthContext',
            './src/services/oauth',
            './src/services/tokenManager',
            './src/services/tokenRefresh',
            './src/services/securityService',
            './src/services/sessionSecurityService'
          ],
          // API and workflow services
          'api-services': [
            './src/services/difyApiClient',
            './src/services/accessControlService',
            './src/services/userAttributeService',
            './src/services/workflowExecutionService'
          ],
          // UI components
          'ui-components': [
            './src/components/Layout',
            './src/components/Navigation',
            './src/components/ProtectedRoute',
            './src/components/ErrorDisplay',
            './src/components/EnhancedErrorDisplay'
          ],
          // Workflow components
          'workflow-components': [
            './src/components/WorkflowList',
            './src/components/WorkflowDashboard',
            './src/components/WorkflowExecutionResults',
            './src/components/OptimizedWorkflowList',
            './src/components/OptimizedWorkflowDashboard'
          ]
        }
      },
      // Tree shaking optimization
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        unknownGlobalSideEffects: false
      }
    },
    // Enable minification for production
    minify: mode === 'production' ? 'terser' : false,
    terserOptions: mode === 'production' ? {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    } : undefined,
  },
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __MODE__: JSON.stringify(mode),
  },
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
}));
