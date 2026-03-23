const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Path to Next.js app root (where next.config.ts lives)
  dir: './',
})

/** @type {import('jest').Config} */
const customConfig = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: [
    '**/__tests__/**/*.test.{ts,tsx}',
    '**/__tests__/**/*.spec.{ts,tsx}',
  ],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@coverguard/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
}

module.exports = createJestConfig(customConfig)
