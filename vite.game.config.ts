import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// Standalone dev server for the play screen - the devvit plugin in vite.config.ts
// only supports `vite build`. Open /game.html.
export default defineConfig({
  root: 'src/client',
  base: './',
  plugins: [react(), tailwind()],
  build: {
    rollupOptions: {
      input: fileURLToPath(new URL('src/client/game.html', import.meta.url)),
    },
  },
});
