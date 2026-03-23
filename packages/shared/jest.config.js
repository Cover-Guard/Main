/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/'],
  moduleNameMapper: {
    // Resolve internal imports within the shared package itself
    '^../types/(.*)$': '<rootDir>/src/types/$1',
  },
}

module.exports = config
