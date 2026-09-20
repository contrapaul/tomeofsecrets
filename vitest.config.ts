import { defineConfig } from 'vitest/config';

// Deliberately no Vite plugins: engine and app logic tests run in plain node.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts', 'worker/**/*.test.ts'],
    environment: 'node',
  },
});
