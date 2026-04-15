/* eslint-disable @typescript-eslint/no-explicit-any */
// Type shim for @hookform/resolvers/zod to work around zod <-> resolver type drift.
// The shipped resolver signature expects ZodType with $ZodTypeInternals (zod v4-style),
// but our pinned zod v3.24.1 predates that. Loosening the signature here is safe because
// the resolver only reads `.parse()` / `.safeParseAsync()` which exist on all zod schemas.
declare module '@hookform/resolvers/zod' {
  export function zodResolver(
    schema: unknown,
    schemaOptions?: unknown,
    resolverOptions?: unknown
  ): any;
}
