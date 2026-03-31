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
  noExternal: [/^(?!(@prisma\/client|prisma|fsevents))/],
  // Keep native/binary deps external — they need real node_modules.
  // @prisma/adapter-pg, pg, and their transitive deps are pure JS and
  // are intentionally bundled so the Vercel function doesn't depend on
  // node_modules for them (npm workspaces hoists pg to the repo root
  // which is outside the function's include path).
  external: ['@prisma/client', 'prisma', 'fsevents'],
  clean: true,
  sourcemap: true,
})
