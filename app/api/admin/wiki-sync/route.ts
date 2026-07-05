import { NextResponse } from 'next/server';
import { requireAlkateraAdmin } from '@/lib/admin/auth';
import { getPublishedWikiPagesFull } from '@/lib/wiki';
import { syncWikiToKnowledgeBase, WIKI_KNOWLEDGE_CATEGORY as WIKI_CATEGORY } from '@/lib/wiki-sync';

export const dynamic = 'force-dynamic';

/**
 * Admin view + manual trigger for the wiki -> Rosa knowledge base sync.
 * The sync itself lives in lib/wiki-sync.ts and runs automatically after
 * every production deploy (netlify/functions/deploy-succeeded.ts ->
 * /api/cron/sync-wiki-to-rosa); this route is the fallback button.
 *
 * Reads wiki/pages from disk at runtime, so next.config.js traces the folder
 * into this route's bundle via outputFileTracingIncludes.
 */

export async function GET() {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;
  const { service } = auth;

  const pagesOnDisk = getPublishedWikiPagesFull().length;

  const { count } = await service
    .from('gaia_knowledge_base')
    .select('id', { count: 'exact', head: true })
    .eq('category', WIKI_CATEGORY);

  const { data: latest } = await service
    .from('gaia_knowledge_base')
    .select('updated_at')
    .eq('category', WIKI_CATEGORY)
    .order('updated_at', { ascending: false })
    .limit(1);

  return NextResponse.json({
    pagesOnDisk,
    syncedCount: count ?? 0,
    lastSyncedAt: latest?.[0]?.updated_at ?? null,
  });
}

export async function POST() {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;
  const { service } = auth;

  try {
    const result = await syncWikiToKnowledgeBase(service);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
