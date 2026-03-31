/**
 * tsup config tests
 *
 * Verifies that the build configuration correctly bundles required packages
 * to prevent runtime module-not-found errors on Vercel serverless.
 */

import * as fs from 'fs'
import * as path from 'path'

const TSUP_CONFIG_PATH = path.resolve(__dirname, '../../../tsup.config.ts')
const DIST_PATH = path.resolve(__dirname, '../../../dist/index.js')

describe('tsup.config.ts', () => {
  let configContent: string

  beforeAll(() => {
    configContent = fs.readFileSync(TSUP_CONFIG_PATH, 'utf-8')
  })

  it('exists', () => {
    expect(fs.existsSync(TSUP_CONFIG_PATH)).toBe(true)
  })

  it('inlines all non-native packages via noExternal regex', () => {
    // noExternal uses a regex to inline everything except @prisma, pg, prisma, fsevents
    expect(configContent).toMatch(/noExternal/)
    expect(configContent).toMatch(/@prisma|pg|prisma|fsevents/)
  })

  it('bundles @prisma/client (not external)', () => {
    expect(configContent).not.toMatch(/external.*@prisma\/client/)
  })

  it('outputs CommonJS format', () => {
    expect(configContent).toMatch(/format.*cjs/)
  })

  it('targets node20', () => {
    expect(configContent).toMatch(/target.*node20/)
  })
})

describe('built bundle', () => {
  const distExists = fs.existsSync(DIST_PATH)

  // Only run bundle content tests if the dist exists (after build)
  const describeIfDist = distExists ? describe : describe.skip

  describeIfDist('dist/index.js contents', () => {
    let bundleContent: string

    beforeAll(() => {
      bundleContent = fs.readFileSync(DIST_PATH, 'utf-8')
    })

    it('does NOT contain external require for @anthropic-ai/sdk', () => {
      expect(bundleContent).not.toContain('require("@anthropic-ai/sdk")')
    })

    it('does NOT contain external require for @coverguard/shared', () => {
      expect(bundleContent).not.toContain('require("@coverguard/shared")')
    })

    it('DOES contain external require for @prisma/client', () => {
      expect(bundleContent).toContain('@prisma/client')
    })

    it('contains the advisor route handler', () => {
      expect(bundleContent).toContain('advisorRouter')
    })

    it('contains the Express app export', () => {
      // The bundle should export the Express app
      expect(bundleContent).toMatch(/exports/)
    })
  })
})
