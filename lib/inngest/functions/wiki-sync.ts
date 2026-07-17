import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inngest } from '../client';
import { syncWikiToKnowledgeBase } from '@/lib/wiki-sync';

/**
 * Re-syncs the public wiki (wiki/pages/*.md) into Rosa's knowledge base.
 *
 * Previously fired by netlify/functions/deploy-succeeded.ts, a Netlify
 * deploy-succeeded hook that only exists on Netlify. Wiki content ships
 * with the deploy, so there's no reliable "just deployed" signal on
 * Vercel worth wiring up — instead this runs every ~6 hours, which is
 * frequent enough that a wiki edit reaches Rosa the same day it merges.
 * Idempotent full replace of the 'wiki' category; safe to re-run.
 *
 * Manual/on-demand equivalent: POST /api/cron/sync-wiki-to-rosa.
 */

function service(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export const wikiSyncTick = inngest.createFunction(
  {
    id: 'wiki-sync-tick',
    name: 'Wiki -> Rosa knowledge-base sync',
    concurrency: { limit: 1 },
    retries: 1,
    triggers: [{ event: 'wiki/sync.tick' }, { cron: '0 */6 * * *' }],
  },
  async ({ step }) => step.run('sync-wiki', () => syncWikiToKnowledgeBase(service())),
);
