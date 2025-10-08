import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API = process.env.VITE_API_URL || 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,             // 0.0.0.0 (fixes some WS edge cases)
    port: 5173,
    strictPort: true,
    cors: true,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
      clientPort: 5173,
      overlay: true,
    },
    proxy: {
      '/api':      { target: API, changeOrigin: true, ws: true },
      '/uploads':  { target: API, changeOrigin: true },
      '/socket.io':{ target: API, changeOrigin: true, ws: true },
    },
  },
});
