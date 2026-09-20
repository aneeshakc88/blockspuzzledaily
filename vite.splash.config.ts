import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Standalone dev server for the feed splash - the devvit plugin in vite.config.ts
// only supports `vite build`. Open /splash.html.
export default defineConfig({
  root: 'src/client',
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: fileURLToPath(new URL('src/client/splash.html', import.meta.url)),
    },
  },
});
