/**
 * One-off: re-run the unified brand scorer across every brand_directory
 * row, using the real recalculateCompleteness pipeline against the DB in
 * .env.local. Run: `npx tsx scripts/run-rescore.ts`
 */
import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { recalculateCompleteness } from '@/lib/distributor/scoring/recalculate';

const env: Record<string, string> = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
// Surface env to any module that reads process.env (gemini, etc.).
for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;

async function main() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('missing supabase url/service key in .env.local');

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as SupabaseClient;

  const { data, error } = await supabase
    .from('brand_directory')
    .select('id')
    .order('updated_at', { ascending: true });
  if (error) throw error;
  const ids = (data ?? []).map((r: { id: string }) => r.id);
  console.log(`rescoring ${ids.length} brands…`);

  let ok = 0;
  let fail = 0;
  const errors: string[] = [];
  let cursor = 0;
  const CONCURRENCY = 5;

  async function worker() {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      try {
        const r = await recalculateCompleteness(supabase, id);
        if (r) ok++;
        else fail++;
      } catch (e) {
        fail++;
        if (errors.length < 12) errors.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
      const done = ok + fail;
      if (done % 10 === 0) console.log(`  ${done}/${ids.length} (ok=${ok} fail=${fail})`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  console.log(`\nDONE. ok=${ok} fail=${fail} of ${ids.length}`);
  if (errors.length) {
    console.log('first errors:');
    for (const e of errors) console.log('  - ' + e);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
