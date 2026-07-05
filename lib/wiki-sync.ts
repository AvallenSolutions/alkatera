import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPublishedWikiPagesFull, wikiBodyForExport } from '@/lib/wiki';

/**
 * Sync the deployed wiki (wiki/pages/*.md, bundled with the function) into
 * gaia_knowledge_base so Rosa's search_knowledge_bank and explain_methodology
 * cite wiki pages with clickable /wiki/<slug> links. Wiki rows are identified
 * by category = 'wiki' and fully replaced per run; nothing else is touched.
 *
 * Callers: the /admin/wiki manual button and the post-deploy cron route.
 * Both routes need wiki/pages traced into their bundles (next.config.js
 * outputFileTracingIncludes).
 */

export const WIKI_KNOWLEDGE_CATEGORY = 'wiki';

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

export async function syncWikiToKnowledgeBase(
  service: SupabaseClient,
): Promise<{ synced: number; lastSyncedAt: string }> {
  const pages = getPublishedWikiPagesFull();
  if (pages.length === 0) {
    // An empty read almost certainly means the folder was not bundled; bail
    // out rather than wiping the existing wiki rows.
    throw new Error('No wiki pages found on disk; sync aborted so existing entries are kept.');
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://alkatera.com';
  const now = new Date().toISOString();

  const rows = pages.map((page) => ({
    entry_type: ENTRY_TYPE_BY_PAGE_TYPE[page.type] ?? 'definition',
    title: page.title,
    content: `${page.summary}\n\n${wikiBodyForExport(page, siteUrl)}`,
    category: WIKI_KNOWLEDGE_CATEGORY,
    tags: Array.from(new Set([...page.tags, page.type, 'wiki'])),
    is_active: true,
    source_url: `${siteUrl}/wiki/${page.slug}`,
    updated_at: now,
  }));

  const { error: deleteError } = await service
    .from('gaia_knowledge_base')
    .delete()
    .eq('category', WIKI_KNOWLEDGE_CATEGORY);
  if (deleteError) throw new Error(`Delete failed: ${deleteError.message}`);

  const { error: insertError } = await service.from('gaia_knowledge_base').insert(rows);
  if (insertError) throw new Error(`Insert failed: ${insertError.message}`);

  return { synced: rows.length, lastSyncedAt: now };
}
