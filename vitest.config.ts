import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      // `server-only` is supplied by the Next.js bundler, not by node_modules.
      // Point it at a no-op so server modules can be unit tested directly.
      'server-only': path.resolve(__dirname, './tests/unit/stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    // Unit tests only. tests/e2e/** are Playwright browser specs driven by a
    // separate runner and must not be collected here.
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**', 'tests/e2e/**'],
  },
})
