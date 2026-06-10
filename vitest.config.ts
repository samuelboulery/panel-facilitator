import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      include: ['src/shared/**'],
      thresholds: { lines: 80, functions: 80, branches: 80 },
    },
  },
})
