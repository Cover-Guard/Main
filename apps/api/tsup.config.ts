import { defineConfig } from 'tsup'

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['cjs'],
    target: 'node20',
    outDir: 'dist',
    bundle: true,
    // Inline everything except CLI tools and OS-specific deps.
    // @prisma/client runtime is pure JS when using driver adapters
    // (@prisma/adapter-pg) and MUST be bundled — npm workspaces hoists it
    // to the repo root node_modules/ which is outside the Vercel serverless
    // function's include path, causing "Cannot find module '@prisma/client'"
    // at runtime.
    noExternal: [/^(?!(prisma|fsevents))/],
    // Only CLI-only and OS-specific packages stay external.
    // @prisma/client is intentionally NOT listed here so it gets bundled.
    external: ['prisma', 'fsevents'],
    clean: true,
    sourcemap: true,
})
