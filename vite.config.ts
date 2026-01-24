import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// Node polyfills configuration shared between main bundle and workers
const nodePolyfillsConfig = {
  include: ['buffer', 'process', 'util', 'stream', 'path'],
  globals: {
    Buffer: true,
    process: true,
  },
};

export default defineConfig({
  plugins: [
    react(),
    // Polyfills needed for @readme/openapi-parser in browser
    nodePolyfills(nodePolyfillsConfig),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
  },
  worker: {
    format: 'es',
    plugins: () => [
      // Workers also need Node polyfills for @readme/openapi-parser
      nodePolyfills(nodePolyfillsConfig),
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
