import { defineConfig } from 'vite';
import { reactRouter } from '@react-router/dev/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [reactRouter()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
