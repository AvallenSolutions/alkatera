/**
 * Wiki full-text search.
 *
 * GET /api/wiki/search?q=scope+3 — top 8 matches across the published wiki
 * pages (title, tags, summary, body), for the wiki map's search box and the
 * room band's "?" panel. Pages are read from disk (lib/wiki.ts); the corpus
 * is cached in module scope with a short TTL so a burst of keystrokes
 * doesn't re-read wiki/pages on every request.
 *
 * Auth-gated like the wiki pages themselves (subscriber-only tool), no
 * organisation scoping needed since wiki content isn't org data.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { getPublishedWikiPagesFull, type WikiPage } from '@/lib/wiki';

export const runtime = 'nodejs';

let corpusCache: { pages: WikiPage[]; ts: number } | null = null;
const CORPUS_TTL_MS = 60_000;

function corpus(): WikiPage[] {
  if (corpusCache && Date.now() - corpusCache.ts < CORPUS_TTL_MS) return corpusCache.pages;
  const pages = getPublishedWikiPagesFull();
  corpusCache = { pages, ts: Date.now() };
  return pages;
}

/** Title match beats tag match beats summary/body substring. */
function scorePage(page: WikiPage, q: string): number {
  const title = page.title.toLowerCase();
  if (title === q) return 100;
  if (title.startsWith(q)) return 85;
  if (title.includes(q)) return 65;
  const tags = page.tags.map((t) => t.toLowerCase());
  if (tags.some((t) => t === q)) return 50;
  if (tags.some((t) => t.includes(q))) return 40;
  if (page.summary.toLowerCase().includes(q)) return 25;
  if (page.body.toLowerCase().includes(q)) return 10;
  return 0;
}

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getSupabaseAPIClient();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim().toLowerCase();
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results = corpus()
    .map((page) => ({ page, score: scorePage(page, q) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ page, score }) => ({
      slug: page.slug,
      title: page.title,
      type: page.type,
      summary: page.summary,
      score,
    }));

  return NextResponse.json({ results });
}
