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
  noExternal: [/^(?!(@prisma|pg|prisma|fsevents))/],
  // Keep native/binary deps external — they need real node_modules
  external: ['@prisma/client', '@prisma/adapter-pg', 'pg', 'prisma', 'fsevents'],
  clean: true,
  sourcemap: true,
})
