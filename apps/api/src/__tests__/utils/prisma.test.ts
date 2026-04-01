/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * prisma.ts — lazy-initialized Prisma client tests
 *
 * Validates that:
 *  - The Prisma client Proxy defers initialization until first property access
 *  - Module import does NOT throw when DATABASE_URL is missing
 *  - Accessing the proxy throws when DATABASE_URL is missing (lazy error)
 *  - The global.__prisma singleton is reused across accesses
 *  - Function properties are properly bound to the real client
 *  - Non-function properties are forwarded correctly
 *  - The proxy works for all Prisma model accessors and utility methods
 */

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockPrismaClient = {
  user: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  property: { findUnique: jest.fn(), findMany: jest.fn() },
  savedProperty: { findMany: jest.fn(), count: jest.fn() },
  searchHistory: { findMany: jest.fn(), count: jest.fn() },
  client: { findMany: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
  propertyReport: { findMany: jest.fn(), count: jest.fn() },
  quoteRequest: { groupBy: jest.fn() },
  subscription: { findFirst: jest.fn() },
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
  $disconnect: jest.fn(),
  $connect: jest.fn(),
  $on: jest.fn(),
  $transaction: jest.fn(),
  _engineVersion: '5.0.0',
}

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn().mockImplementation(() => ({})),
}))

jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrismaClient),
}))

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    http: jest.fn(),
  },
}))

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Save and restore individual env vars instead of replacing process.env
 *  (replacing the whole object can behave differently across Node versions). */
const ENV_KEYS = ['DATABASE_URL', 'POSTGRES_PRISMA_URL', 'POSTGRES_URL', 'NODE_ENV', 'LOG_LEVEL'] as const
let savedEnv: Record<string, string | undefined>

function saveEnv() {
  savedEnv = {}
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k]
}

function restoreEnv() {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k]
    else process.env[k] = savedEnv[k]
  }
}

function resetModuleAndGlobals() {
  delete (global as Record<string, unknown>).__prisma
  // Keep __prismaShutdownRegistered intact to prevent listener accumulation.
  // Only the "shutdown listener registration" describe block clears it.
  jest.resetModules()
}

function loadPrismaModule() {
   
  return require('../../utils/prisma') as { prisma: Record<string, unknown> }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('prisma.ts — lazy Proxy initialization', () => {
  beforeEach(() => {
    saveEnv()
    resetModuleAndGlobals()
    jest.clearAllMocks()
  })

  afterEach(() => {
    restoreEnv()
    delete (global as Record<string, unknown>).__prisma
  })

  // ── Module import safety ────────────────────────────────────────────────

  describe('module import', () => {
    it('does not throw when all connection string env vars are missing', () => {
      delete process.env.DATABASE_URL
      delete process.env.POSTGRES_PRISMA_URL
      delete process.env.POSTGRES_URL
      expect(() => loadPrismaModule()).not.toThrow()
    })

    it('does not throw when DATABASE_URL is set', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
      expect(() => loadPrismaModule()).not.toThrow()
    })

    it('exports a prisma object', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
      const mod = loadPrismaModule()
      expect(mod.prisma).toBeDefined()
    })

    it('does not create PrismaClient at import time', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
      const { PrismaClient } = require('../../generated/prisma/client')
      const callsBefore = (PrismaClient as jest.Mock).mock.calls.length
      loadPrismaModule()
      const callsAfter = (PrismaClient as jest.Mock).mock.calls.length
      expect(callsAfter).toBe(callsBefore)
    })
  })

  // ── Lazy initialization ────────────────────────────────────────────────

  describe('lazy initialization on first access', () => {
    it('creates PrismaClient on first property access', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
      const { PrismaClient } = require('../../generated/prisma/client')
      const mod = loadPrismaModule()
      ;(PrismaClient as jest.Mock).mockClear()

      // Access a property to trigger lazy init
      void mod.prisma.user
      expect(PrismaClient).toHaveBeenCalledTimes(1)
    })

    it('does not recreate PrismaClient on subsequent accesses', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
      const { PrismaClient } = require('../../generated/prisma/client')
      const mod = loadPrismaModule()
      ;(PrismaClient as jest.Mock).mockClear()

      void mod.prisma.user
      void mod.prisma.property
      void mod.prisma.savedProperty
      expect(PrismaClient).toHaveBeenCalledTimes(1)
    })

    it('throws on first access when no connection string env var is set', () => {
      delete process.env.DATABASE_URL
      delete process.env.POSTGRES_PRISMA_URL
      delete process.env.POSTGRES_URL
      const mod = loadPrismaModule()
      expect(() => mod.prisma.user).toThrow('Database connection string is not configured')
    })

    it('throws descriptive error message listing all accepted env vars', () => {
      delete process.env.DATABASE_URL
      delete process.env.POSTGRES_PRISMA_URL
      delete process.env.POSTGRES_URL
      const mod = loadPrismaModule()
      expect(() => mod.prisma.$connect).toThrow(/DATABASE_URL/)
      expect(() => mod.prisma.$connect).toThrow(/POSTGRES_PRISMA_URL/)
    })
  })

  // ── Singleton / global caching ─────────────────────────────────────────

  describe('global.__prisma singleton', () => {
    it('stores client in global.__prisma after first access', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
      const mod = loadPrismaModule()
      expect((global as Record<string, unknown>).__prisma).toBeUndefined()
      void mod.prisma.user
      expect((global as Record<string, unknown>).__prisma).toBeDefined()
    })

    it('reuses existing global.__prisma if present', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
      const sentinel = { user: { findUnique: jest.fn() } }
      ;(global as Record<string, unknown>).__prisma = sentinel
      const mod = loadPrismaModule()
      expect(mod.prisma.user).toBe(sentinel.user)
    })

    it('does not call PrismaClient constructor when global.__prisma exists', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
      const { PrismaClient } = require('../../generated/prisma/client')
      ;(global as Record<string, unknown>).__prisma = mockPrismaClient
      ;(PrismaClient as jest.Mock).mockClear()
      const mod = loadPrismaModule()
      void mod.prisma.user
      expect(PrismaClient).not.toHaveBeenCalled()
    })
  })

  // ── Proxy property forwarding ──────────────────────────────────────────

  describe('proxy property forwarding', () => {
    let mod: { prisma: Record<string, unknown> }

    beforeEach(() => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
      mod = loadPrismaModule()
    })

    it('forwards .user model accessor', () => {
      expect(mod.prisma.user).toBe(mockPrismaClient.user)
    })

    it('forwards .property model accessor', () => {
      expect(mod.prisma.property).toBe(mockPrismaClient.property)
    })

    it('forwards .savedProperty model accessor', () => {
      expect(mod.prisma.savedProperty).toBe(mockPrismaClient.savedProperty)
    })

    it('forwards .searchHistory model accessor', () => {
      expect(mod.prisma.searchHistory).toBe(mockPrismaClient.searchHistory)
    })

    it('forwards .client model accessor', () => {
      expect(mod.prisma.client).toBe(mockPrismaClient.client)
    })

    it('forwards .propertyReport model accessor', () => {
      expect(mod.prisma.propertyReport).toBe(mockPrismaClient.propertyReport)
    })

    it('forwards .quoteRequest model accessor', () => {
      expect(mod.prisma.quoteRequest).toBe(mockPrismaClient.quoteRequest)
    })

    it('forwards .subscription model accessor', () => {
      expect(mod.prisma.subscription).toBe(mockPrismaClient.subscription)
    })

    it('forwards non-function properties directly', () => {
      expect(mod.prisma._engineVersion).toBe('5.0.0')
    })

    it('returns undefined for non-existent properties', () => {
      expect(mod.prisma.nonExistentProp).toBeUndefined()
    })
  })

  // ── Proxy method binding ───────────────────────────────────────────────

  describe('proxy method binding', () => {
    let mod: { prisma: Record<string, unknown> }

    beforeEach(() => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
      mod = loadPrismaModule()
    })

    it('binds $queryRaw as a callable function', () => {
      expect(typeof mod.prisma.$queryRaw).toBe('function')
    })

    it('binds $executeRaw as a callable function', () => {
      expect(typeof mod.prisma.$executeRaw).toBe('function')
    })

    it('binds $disconnect as a callable function', () => {
      expect(typeof mod.prisma.$disconnect).toBe('function')
    })

    it('binds $connect as a callable function', () => {
      expect(typeof mod.prisma.$connect).toBe('function')
    })

    it('binds $on as a callable function', () => {
      expect(typeof mod.prisma.$on).toBe('function')
    })

    it('binds $transaction as a callable function', () => {
      expect(typeof mod.prisma.$transaction).toBe('function')
    })

    it('calls $disconnect on the real client', async () => {
      mockPrismaClient.$disconnect.mockResolvedValue(undefined)
      const disconnect = mod.prisma.$disconnect as () => Promise<void>
      await disconnect()
      expect(mockPrismaClient.$disconnect).toHaveBeenCalledTimes(1)
    })

    it('calls $queryRaw on the real client with arguments', async () => {
      mockPrismaClient.$queryRaw.mockResolvedValue([{ count: 5 }])
      const queryRaw = mod.prisma.$queryRaw as (...args: unknown[]) => Promise<unknown>
      const result = await queryRaw('SELECT 1')
      expect(mockPrismaClient.$queryRaw).toHaveBeenCalledWith('SELECT 1')
      expect(result).toEqual([{ count: 5 }])
    })

    it('calls $transaction on the real client', async () => {
      mockPrismaClient.$transaction.mockResolvedValue(['result1', 'result2'])
      const tx = mod.prisma.$transaction as (...args: unknown[]) => Promise<unknown>
      const result = await tx([])
      expect(mockPrismaClient.$transaction).toHaveBeenCalledWith([])
      expect(result).toEqual(['result1', 'result2'])
    })
  })

  // ── PrismaClient constructor configuration ────────────────────────────

  describe('PrismaClient constructor', () => {
    it('passes pg adapter with connection string', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db'
      const { PrismaPg } = require('@prisma/adapter-pg')
      const mod = loadPrismaModule()
      void mod.prisma.user // trigger lazy init
      expect(PrismaPg).toHaveBeenCalledWith(expect.anything())
    })

    it('configures production logging (error + warn)', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
      process.env.NODE_ENV = 'production'
      const { PrismaClient } = require('../../generated/prisma/client')
      ;(PrismaClient as jest.Mock).mockClear()
      const mod = loadPrismaModule()
      void mod.prisma.user
      const config = (PrismaClient as jest.Mock).mock.calls[0][0]
      expect(config.log).toEqual([
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ])
    })

    it('configures dev logging (query + error + warn)', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
      process.env.NODE_ENV = 'development'
      const { PrismaClient } = require('../../generated/prisma/client')
      ;(PrismaClient as jest.Mock).mockClear()
      const mod = loadPrismaModule()
      void mod.prisma.user
      const config = (PrismaClient as jest.Mock).mock.calls[0][0]
      expect(config.log).toEqual([
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ])
    })
  })

  // ── Shutdown listener guard ────────────────────────────────────────────

  describe('shutdown listener registration', () => {
    beforeEach(() => {
      // These tests specifically need a clean shutdown flag
      delete (global as Record<string, unknown>).__prismaShutdownRegistered
    })

    it('registers shutdown listeners on first load', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
      loadPrismaModule()
      expect((global as Record<string, unknown>).__prismaShutdownRegistered).toBe(true)
    })

    it('does not register duplicate listeners on repeated module loads', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
      const listenersBefore = process.listenerCount('SIGTERM')
      // First load sets the guard flag
      jest.resetModules()
      loadPrismaModule()
      // Second load should skip registration because guard flag is set
      jest.resetModules()
      loadPrismaModule()
      const listenersAfter = process.listenerCount('SIGTERM')
      // Should add at most 1 new listener (the first load only)
      expect(listenersAfter - listenersBefore).toBeLessThanOrEqual(1)
    })
  })
})
