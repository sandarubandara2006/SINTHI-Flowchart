/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// `base` is set for GitHub Pages project-site hosting (https://<user>.github.io/SINTHI-Flowchart/).
// Override with VITE_BASE='/' for local/custom-domain deploys.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/SINTHI-Flowchart/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
