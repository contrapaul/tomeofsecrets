import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5174,
    strictPort: true,
    // Accounts: `npm run dev:api` runs the Worker against local D1 on 8788; the game talks to it as if same-origin.
    proxy: { '/api': 'http://localhost:8788' },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
