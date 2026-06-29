import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxy: the React app calls /api and /health on itself; Vite forwards to the API.
const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:3007';
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/health': { target: apiTarget, changeOrigin: true },
    },
  },
  build: {
    // Perf budget signal (Rule #5): warn if any chunk exceeds 300KB.
    chunkSizeWarningLimit: 300,
  },
});
