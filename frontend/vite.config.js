import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The dev server forwards /api to the Node.js backend. Port 5174 avoids clashing
// with other Vite projects that use the default 5173.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: { '/api': process.env.M3_BACKEND_URL ?? 'http://localhost:4000' },
  },
});
