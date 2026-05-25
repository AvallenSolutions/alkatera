import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Pull every brand name the platform already knows about (canonical
 * directory + alka**tera** customer organizations) so the sourcing
 * prompt can tell the LLM not to propose them again.
 *
 * The matcher provides the hard guarantee against duplicates at insert
 * time; this is just hint-based prevention that saves a chunk's worth
 * of LLM spend when the model would otherwise return a name we'd
 * immediately dedup.
 *
 * Capped at MAX_EXCLUSIONS so the prompt stays compact. The most
 * recently updated directory entries and orgs are favoured because
 * those are the most likely to be propose-able again right now.
 */
const MAX_EXCLUSIONS = 300;

export async function loadKnownBrandNames(service: SupabaseClient): Promise<string[]> {
  const directoryPromise = service
    .from('brand_directory')
    .select('name, updated_at')
    .order('updated_at', { ascending: false })
    .limit(MAX_EXCLUSIONS);

  const orgsPromise = service
    .from('organizations')
    .select('name, updated_at')
    .not('name', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(MAX_EXCLUSIONS);

  const [{ data: dirRows }, { data: orgRows }] = await Promise.all([
    directoryPromise,
    orgsPromise,
  ]);

  const seen = new Set<string>();
  const out: string[] = [];

  function push(name: unknown) {
    if (typeof name !== 'string') return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(trimmed);
  }

  for (const row of (dirRows ?? []) as Array<{ name: string }>) push(row.name);
  for (const row of (orgRows ?? []) as Array<{ name: string }>) push(row.name);

  return out.slice(0, MAX_EXCLUSIONS);
}
