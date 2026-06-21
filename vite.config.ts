import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    // Retry timing-flaky tests up to 2× (3 attempts). The suite (~1985 tests)
    // runs many files in parallel; under CPU starvation a userEvent interaction
    // can occasionally race the React commit (e.g. a controlled input not yet
    // flushed before the next assertion), producing intermittent failures that
    // pass in isolation. A retry absorbs that class WITHOUT masking real bugs:
    // a deterministic failure fails all 3 attempts. Seen on TaskCommentsTimeline
    // + CustomerSidebar in the full-suite run while green in isolation.
    retry: 2,
    exclude: [...configDefaults.exclude, '**/.claude/**', '**/.claire/**', '**/worktrees/**'],
    setupFiles: ['./src/test/setup.ts'],
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
    alias: {
      leaflet: resolve(__dirname, './src/__mocks__/leaflet.ts'),
      'react-leaflet': resolve(__dirname, './src/__mocks__/react-leaflet.tsx'),
      // Mock leaflet-draw (JS augmentation) and its CSS so tests don't hit the real UMD bundle
      'leaflet-draw/dist/leaflet.draw.css': resolve(__dirname, './src/__mocks__/leaflet-draw.css'),
      'leaflet-draw': resolve(__dirname, './src/__mocks__/leaflet-draw.ts'),
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
