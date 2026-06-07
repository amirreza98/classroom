import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      // Arcjet won't actually run in test mode, but needs a value to pass init
      ARCJET_KEY: 'ajkey_00000000000000000000000000000000',
      // db/index.ts is fully mocked in tests — this is a placeholder
      DATABASE_URL: 'postgresql://test:test@localhost/testdb',
      FRONTEND_URL: 'http://localhost:3000',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/routes/**/*.ts'],
      exclude: ['src/__tests__/**'],
      thresholds: {
        lines: 70,
        branches: 60,
      },
    },
  },
});
