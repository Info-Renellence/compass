// Compass front end: React + Vite, the same stack as Edge's web app (renellence-edge/vite.config.js).
// Source in src/, built to dist/ which Vercel serves. An API (api/) comes in phase 3, when the data layer is wired.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
  server: { port: 5183, strictPort: true },
  preview: { port: 5184, strictPort: true },
});
