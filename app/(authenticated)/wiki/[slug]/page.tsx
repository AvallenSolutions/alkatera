import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CalendarCheck, Link2 } from 'lucide-react';
import {
  getWikiPage,
  getWikiBacklinks,
  renderWikiHtml,
  WIKI_TYPE_LABELS,
} from '@/lib/wiki';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { Eyebrow } from '@/components/studio/eyebrow';

// Standalone article view (permalink target from the map's reader popout and
// Rosa's citations). Session-gated server-side like the map page.

// Metadata renders before the page's auth gate, so keep it neutral: no
// summary/description here or it leaks to unauthenticated requests.
export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const page = getWikiPage(params.slug);
  if (!page) return { title: 'Page not found' };
  return {
    title: `${page.title} | alkatera`,
    robots: { index: false, follow: false },
  };
}

function formatDate(isoDate: string): string {
  if (!isoDate) return '';
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default async function WikiPage({ params }: { params: { slug: string } }) {
  const supabase = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const page = getWikiPage(params.slug);
  if (!page) notFound();

  const html = renderWikiHtml(page);
  const backlinks = getWikiBacklinks(page.slug);

  return (
    <div>
      <article className="mx-auto max-w-3xl">
        <Link
          href="/wiki"
          className="group mb-10 inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.18em] text-studio-dim transition-colors duration-200 hover:text-studio-brick"
        >
          <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
          Back to the wiki
        </Link>

        <header className="mb-10 space-y-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Eyebrow tone="room">{WIKI_TYPE_LABELS[page.type]}</Eyebrow>
            {page.lastReviewed && (
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
                <CalendarCheck className="h-3.5 w-3.5" />
                Last reviewed {formatDate(page.lastReviewed)}
              </span>
            )}
          </div>

          <h1 className="font-display text-4xl font-bold leading-[0.95] tracking-[-0.035em] text-foreground md:text-5xl">
            {page.title}
          </h1>
        </header>

        <div className="wiki-prose" dangerouslySetInnerHTML={{ __html: html }} />

        {page.sources.length > 0 && (
          <section className="mt-14 border-t border-border pt-8">
            <Eyebrow tone="dim" className="mb-4">
              Sources
            </Eyebrow>
            <ul className="space-y-2">
              {page.sources.map((source, i) => (
                <li key={i} className="text-sm">
                  {source.url ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground transition-colors duration-200 hover:text-studio-brick"
                    >
                      {source.title}
                    </a>
                  ) : (
                    <span className="text-foreground">{source.title}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {backlinks.length > 0 && (
          <section className="mt-10 border-t border-border pt-8">
            <Eyebrow tone="dim" className="mb-6 inline-flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Referenced by
            </Eyebrow>
            <div className="grid gap-4 sm:grid-cols-2">
              {backlinks.map((link) => (
                <Link
                  key={link.slug}
                  href={`/wiki/${link.slug}`}
                  className="group block rounded-[6px] border border-border bg-card p-5 transition-colors duration-200 hover:border-studio-brick/60"
                >
                  <h3 className="mb-1 text-base font-semibold text-foreground transition-colors duration-200 group-hover:text-studio-brick">
                    {link.title}
                  </h3>
                  <p className="line-clamp-2 text-sm leading-relaxed text-studio-dim">
                    {link.summary}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </div>
  );
}
