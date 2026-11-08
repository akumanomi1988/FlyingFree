import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  base: '/FlyingFree/',
  build: { target: 'es2022', cssCodeSplit: false,
    rollupOptions: { input: { app: resolve('index.html'), 'asset-preview': resolve('asset-preview.html') } } },
  server: { host: '127.0.0.1', port: 4173, strictPort: true }
});
