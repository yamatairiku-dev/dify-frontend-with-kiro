import { defineConfig } from 'vite';
import { reactRouter } from '@react-router/dev/vite';
import { securityPlugin } from './src/plugins/vite-security-plugin';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    reactRouter(),
    securityPlugin({
      enabled: true,
      injectCSP: true,
      injectSecurityHeaders: true,
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
    sourcemap: true,
    rollupOptions: {
      output: {
        // Ensure consistent chunk naming for CSP
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
});
