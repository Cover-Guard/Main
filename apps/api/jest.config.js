/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/'],
  moduleNameMapper: {
    '^@coverguard/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
  // Coverage scaffold (PR-D2). Thresholds intentionally start at 0 so this PR
  // doesn't fail CI on existing coverage gaps. Follow-up PRs ratchet the
  // numbers up — target: ≥70% for services/, ≥60% for shared, ≥50% global.
  // Run `npm test -- --coverage` to see current numbers before bumping.
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0,
    },
  },
}

module.exports = config
