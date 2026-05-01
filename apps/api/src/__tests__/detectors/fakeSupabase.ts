/**
 * Tiny chainable supabase mock for detector tests (PR 8).
 *
 * Real detectors call `supabase.from(tbl).select(...).eq(col, val).gte(...)`
 * etc. The mock returns the same chainable shape for any call sequence and
 * only resolves the final terminal — `await` on the chain itself, or
 * `.maybeSingle()` / `.single()`. The test wires up a `responses` map keyed
 * by table name so each detector can return its own canned rows.
 */

export interface CannedResult {
  data?: unknown
  error?: { message: string } | null
  count?: number | null
}

export type Responses = Record<string, CannedResult>

interface ChainableQuery {
  select(...args: unknown[]): ChainableQuery
  eq(...args: unknown[]): ChainableQuery
  in(...args: unknown[]): ChainableQuery
  gte(...args: unknown[]): ChainableQuery
  lte(...args: unknown[]): ChainableQuery
  gt(...args: unknown[]): ChainableQuery
  lt(...args: unknown[]): ChainableQuery
  is(...args: unknown[]): ChainableQuery
  or(...args: unknown[]): ChainableQuery
  order(...args: unknown[]): ChainableQuery
  limit(...args: unknown[]): ChainableQuery
  range(...args: unknown[]): ChainableQuery
  filter(...args: unknown[]): ChainableQuery
  maybeSingle(): Promise<CannedResult>
  single(): Promise<CannedResult>
  then<T>(onFulfilled: (v: CannedResult) => T): Promise<T>
}

export function makeFakeSupabase(responses: Responses): {
  from(table: string): ChainableQuery
} {
  return {
    from(table: string): ChainableQuery {
      const result = responses[table] ?? { data: [], error: null }
      const chain: ChainableQuery = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        gte: () => chain,
        lte: () => chain,
        gt: () => chain,
        lt: () => chain,
        is: () => chain,
        or: () => chain,
        order: () => chain,
        limit: () => chain,
        range: () => chain,
        filter: () => chain,
        maybeSingle: () => Promise.resolve(result),
        single: () => Promise.resolve(result),
        then: (onFulfilled) => Promise.resolve(onFulfilled(result)),
      }
      return chain
    },
  }
}
