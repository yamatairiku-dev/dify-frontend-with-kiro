import type { Config } from '@react-router/dev/config';

export default {
  // Enable SPA mode (no server-side rendering)
  ssr: false,

  // Configure the app directory
  appDirectory: 'app',

  // Configure build directory
  buildDirectory: 'dist',

  // Configure public directory
  publicPath: '/',

  // Performance optimizations
  future: {
    // Enable future flags for better performance
    unstable_optimizeDeps: true,
  },

  // Preload configuration for better navigation performance
  preloadRouteModules: true,

  // Bundle splitting configuration
  browserNodeBuiltinsPolyfill: {
    modules: {
      // Only polyfill what we actually need
      buffer: true,
      crypto: true,
      stream: true,
      util: true,
    },
  },
} satisfies Config;
