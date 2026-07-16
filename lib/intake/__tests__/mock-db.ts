/**
 * A minimal, deliberately dumb Supabase client stand-in for lib/intake unit
 * tests. Each table gets a FIFO queue of `{ data, error }` responses; every
 * chain method (`select`, `eq`, `is`, `ilike`, `in`, `update`) just records
 * the call and returns the same builder, and the builder is itself
 * thenable so both `await ...maybeSingle()` and a bare `await
 * db.from(...).select(...).eq(...)` (no terminal method) resolve to the
 * next queued response for that table.
 */
export interface RecordedCall {
  table: string;
  method: string;
  args: unknown[];
}

export function createMockDb(responses: Record<string, Array<{ data: unknown; error: unknown }>>) {
  const calls: RecordedCall[] = [];
  const queues: Record<string, Array<{ data: unknown; error: unknown }>> = Object.fromEntries(
    Object.entries(responses).map(([table, list]) => [table, [...list]])
  );

  function builder(table: string) {
    const resolveNext = () => {
      const queue = queues[table];
      const next = queue && queue.length > 0 ? queue.shift()! : { data: null, error: null };
      return Promise.resolve(next);
    };

    const b: any = {};
    const chain = (method: string) => (...args: unknown[]) => {
      calls.push({ table, method, args });
      return b;
    };
    b.select = chain('select');
    b.eq = chain('eq');
    b.is = chain('is');
    b.ilike = chain('ilike');
    b.in = chain('in');
    b.update = chain('update');
    b.maybeSingle = () => resolveNext();
    b.single = () => resolveNext();
    b.then = (onFulfilled: any, onRejected: any) => resolveNext().then(onFulfilled, onRejected);
    return b;
  }

  return {
    from: (table: string) => builder(table),
    calls,
  };
}
