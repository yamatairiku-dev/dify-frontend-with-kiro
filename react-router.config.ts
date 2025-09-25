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
} satisfies Config;
