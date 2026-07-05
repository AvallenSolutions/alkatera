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
    <div className="p-6">
      <article className="mx-auto max-w-3xl">
        <Link
          href="/wiki"
          className="group mb-10 inline-flex items-center gap-2 font-mono text-sm uppercase tracking-widest text-gray-400 transition-all duration-300 hover:text-[#ccff00]"
        >
          <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
          Back to the wiki
        </Link>

        <header className="mb-10 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-md border border-[#ccff00]/30 bg-[#ccff00]/10 px-4 py-1.5 font-mono text-xs uppercase tracking-widest text-[#ccff00]">
              {WIKI_TYPE_LABELS[page.type]}
            </span>
            {page.lastReviewed && (
              <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-gray-500">
                <CalendarCheck className="h-3.5 w-3.5" />
                Last reviewed {formatDate(page.lastReviewed)}
              </span>
            )}
          </div>

          <h1 className="font-serif text-4xl leading-tight tracking-tight text-white md:text-5xl">
            {page.title}
          </h1>
        </header>

        <div className="wiki-prose" dangerouslySetInnerHTML={{ __html: html }} />

        {page.sources.length > 0 && (
          <section className="mt-14 border-t border-white/10 pt-8">
            <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-gray-500">
              Sources
            </h2>
            <ul className="space-y-2">
              {page.sources.map((source, i) => (
                <li key={i} className="text-sm">
                  {source.url ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-300 transition-colors duration-300 hover:text-[#ccff00]"
                    >
                      {source.title}
                    </a>
                  ) : (
                    <span className="text-gray-300">{source.title}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {backlinks.length > 0 && (
          <section className="mt-10 border-t border-white/10 pt-8">
            <h2 className="mb-6 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-gray-500">
              <Link2 className="h-4 w-4" />
              Referenced by
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {backlinks.map((link) => (
                <Link
                  key={link.slug}
                  href={`/wiki/${link.slug}`}
                  className="group block rounded-xl border border-white/10 bg-white/[0.03] p-5 transition-all duration-300 hover:border-[#ccff00]/50"
                >
                  <h3 className="mb-1 text-base font-semibold text-white transition-colors duration-300 group-hover:text-[#ccff00]">
                    {link.title}
                  </h3>
                  <p className="line-clamp-2 text-sm leading-relaxed text-gray-400">
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
