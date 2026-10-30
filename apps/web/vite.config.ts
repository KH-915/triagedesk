import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxy: the browser talks to Vite on :5173, which forwards /api to the Node API.
// The frontend never talks to the ML service or the database directly.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000' } },
});
