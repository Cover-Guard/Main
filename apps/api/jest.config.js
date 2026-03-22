/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/'],
  moduleNameMapper: {
    '^@coverguard/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
}

module.exports = config
