import { NextResponse } from 'next/server';
import { requireAlkateraAdmin } from '@/lib/admin/auth';
import { getPublishedWikiPagesFull, wikiBodyForExport } from '@/lib/wiki';

export const dynamic = 'force-dynamic';

/**
 * Admin sync of the public wiki (wiki/pages/*.md, shipped with the deploy)
 * into gaia_knowledge_base, so Rosa's search_knowledge_bank and
 * explain_methodology tools surface wiki pages with clickable /wiki/<slug>
 * citations. Wiki rows are identified by category = 'wiki' and fully replaced
 * on every sync; nothing outside that category is touched.
 *
 * Reads wiki/pages from disk at runtime, so next.config.js traces the folder
 * into this route's bundle via outputFileTracingIncludes.
 */

const WIKI_CATEGORY = 'wiki';

// glossary/concept pages are definitions; guides, standards and legislation
// are guidance. (gaia entry_type check constraint allows: instruction,
// example_qa, definition, guideline.)
const ENTRY_TYPE_BY_PAGE_TYPE: Record<string, 'definition' | 'guideline'> = {
  glossary: 'definition',
  concept: 'definition',
  guide: 'guideline',
  standard: 'guideline',
  legislation: 'guideline',
};

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

  const pages = getPublishedWikiPagesFull();
  if (pages.length === 0) {
    // An empty read almost certainly means the folder was not bundled; bail
    // out rather than wiping the existing wiki rows.
    return NextResponse.json(
      { error: 'No wiki pages found on disk; sync aborted so existing entries are kept.' },
      { status: 500 },
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://alkatera.com';
  const now = new Date().toISOString();

  const rows = pages.map((page) => ({
    entry_type: ENTRY_TYPE_BY_PAGE_TYPE[page.type] ?? 'definition',
    title: page.title,
    content: `${page.summary}\n\n${wikiBodyForExport(page, siteUrl)}`,
    category: WIKI_CATEGORY,
    tags: Array.from(new Set([...page.tags, page.type, 'wiki'])),
    is_active: true,
    source_url: `${siteUrl}/wiki/${page.slug}`,
    updated_at: now,
  }));

  const { error: deleteError } = await service
    .from('gaia_knowledge_base')
    .delete()
    .eq('category', WIKI_CATEGORY);
  if (deleteError) {
    return NextResponse.json({ error: `Delete failed: ${deleteError.message}` }, { status: 500 });
  }

  const { error: insertError } = await service.from('gaia_knowledge_base').insert(rows);
  if (insertError) {
    return NextResponse.json({ error: `Insert failed: ${insertError.message}` }, { status: 500 });
  }

  return NextResponse.json({ synced: rows.length, lastSyncedAt: now });
}
