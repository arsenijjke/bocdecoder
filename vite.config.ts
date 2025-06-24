import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/bocdecoder/',
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        start: resolve(__dirname, 'start.html'),
      },
    },
  },
  server: {
    open: '/bocdecoder/index.html',
  },
});