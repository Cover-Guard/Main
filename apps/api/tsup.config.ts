import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  target: 'node20',
  outDir: 'dist',
  bundle: true,
  // Inline the workspace package so Vercel doesn't need to resolve it
  noExternal: ['@coverguard/shared'],
  // Keep heavy native/binary deps external — they're installed normally
  external: ['@prisma/client', '@prisma/adapter-pg', 'pg', 'prisma', 'fsevents'],
  clean: true,
  sourcemap: true,
})
