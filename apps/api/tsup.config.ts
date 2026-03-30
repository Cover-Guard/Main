import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  target: 'node20',
  outDir: 'dist',
  bundle: true,
  // Inline everything except native/binary deps that can't be bundled.
  // This eliminates runtime require() calls for pure-JS packages (express,
  // dotenv, winston, etc.) so the Vercel serverless function doesn't depend
  // on node_modules for them.
  noExternal: [/^(?!(@prisma\/client|pg|prisma|fsevents))/],
  // Keep native/binary deps external — they need real node_modules.
  // @prisma/adapter-pg and @prisma/driver-adapter-utils are pure JS and
  // are intentionally bundled so they don't need node_modules at runtime.
  external: ['@prisma/client', 'pg', 'prisma', 'fsevents'],
  clean: true,
  sourcemap: true,
})
