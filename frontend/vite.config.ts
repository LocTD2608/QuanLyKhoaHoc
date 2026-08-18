import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 10001,
    host: true,
    watch: {
      ignored: ['**/backend/**'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:10000',
        changeOrigin: true,
      }
    }
  }
});
