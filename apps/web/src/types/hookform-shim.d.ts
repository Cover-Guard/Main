// Type shim for @hookform/resolvers/zod to bridge a zod <-> resolver type drift.
//
// The shipped resolver declarations reference ZodType internals (`$ZodTypeInternals`)
// from zod v4, but we're pinned to zod v3.24.1. We re-declare a narrower signature
// using only public zod v3 and react-hook-form types. This is safe because the
// resolver implementation only reads `.parse()` / `.safeParseAsync()` — both present
// on every zod v3 schema — so the runtime contract is unchanged.
//
// Replaces the previous `any`-based shim (see PR #272) so we can drop the
// `@typescript-eslint/no-explicit-any` override and let form consumers keep full
// type inference through `useForm<FormData>({ resolver: zodResolver(schema) })`.

declare module '@hookform/resolvers/zod' {
  import type { ZodType, ZodTypeDef } from 'zod'
  import type { FieldValues, Resolver } from 'react-hook-form'

  export function zodResolver<
    TFieldValues extends FieldValues = FieldValues,
    TContext = unknown,
  >(
    schema: ZodType<TFieldValues, ZodTypeDef, unknown>,
    schemaOptions?: Partial<{
      errorMap: unknown
      async: boolean
      path: Array<string | number>
    }>,
    resolverOptions?: { mode?: 'async' | 'sync'; raw?: boolean },
  ): Resolver<TFieldValues, TContext>
}
