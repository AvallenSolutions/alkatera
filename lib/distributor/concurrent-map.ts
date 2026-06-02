/**
 * Run `fn` over `items` with at most `limit` promises in flight at once,
 * preserving result order. Used by the SKU-import matchers to turn long
 * serial chains of Supabase round-trips into bounded-parallel batches —
 * the single biggest speed lever for large distributor catalogues.
 *
 * Callers must dedupe inputs first (so no two concurrent tasks contend on
 * the same canonical row) and handle per-item failures inside `fn`.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
