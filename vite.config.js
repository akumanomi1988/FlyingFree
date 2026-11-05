import { defineConfig } from 'vite';
export default defineConfig({
  base: '/FlyingFree/',
  build: { target: 'es2022', cssCodeSplit: false },
  server: { host: '127.0.0.1', port: 4173, strictPort: true }
});
