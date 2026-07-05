import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CalendarCheck, Link2 } from 'lucide-react';
import { Navigation } from '@/marketing/components/Navigation';
import { Footer } from '@/marketing/components/Footer';
import {
  getPublishedWikiPages,
  getWikiPage,
  getWikiBacklinks,
  renderWikiHtml,
  WIKI_TYPE_LABELS,
} from '@/lib/wiki';

// All wiki pages are generated at build time from wiki/pages/*.md; unknown
// slugs 404 without ever running server-side.
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return getPublishedWikiPages().map((page) => ({ slug: page.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const page = getWikiPage(params.slug);
  if (!page) return { title: 'Page not found' };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://alkatera.com';
  const pageUrl = `${siteUrl}/wiki/${page.slug}`;
  const title = `${page.title} | alkatera`;

  return {
    title,
    description: page.summary,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title,
      description: page.summary,
      url: pageUrl,
      siteName: 'alkatera',
      locale: 'en_GB',
      type: 'article',
    },
    twitter: {
      card: 'summary',
      title,
      description: page.summary,
    },
  };
}

function formatDate(isoDate: string): string {
  if (!isoDate) return '';
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function WikiPage({ params }: { params: { slug: string } }) {
  const page = getWikiPage(params.slug);
  if (!page) notFound();

  const html = renderWikiHtml(page);
  const backlinks = getWikiBacklinks(page.slug);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://alkatera.com';
  const pageUrl = `${siteUrl}/wiki/${page.slug}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: page.title,
    description: page.summary,
    dateModified: page.lastReviewed || undefined,
    author: {
      '@type': 'Organization',
      name: 'alkatera',
      url: siteUrl,
    },
    url: pageUrl,
    mainEntityOfPage: pageUrl,
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white relative">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Fixed background layer */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[#050505]" />
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }}
        />
        <div className="absolute top-[20%] left-[10%] w-[500px] h-[500px] bg-[#ccff00] rounded-full opacity-[0.07] blur-[100px]" />
      </div>

      <div className="relative z-10">
        <Navigation />

        <main className="pt-32 pb-24">
          <article className="max-w-3xl mx-auto px-6">
            <Link
              href="/wiki"
              className="inline-flex items-center gap-2 text-gray-400 hover:text-[#ccff00] transition-all duration-300 mb-12 font-mono text-sm uppercase tracking-widest group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-300" />
              Back to the wiki
            </Link>

            <header className="mb-12 space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-4 py-1.5 bg-[#ccff00]/10 border border-[#ccff00]/30 text-[#ccff00] font-mono text-xs uppercase tracking-widest rounded-md">
                  {WIKI_TYPE_LABELS[page.type]}
                </span>
                {page.lastReviewed && (
                  <span className="inline-flex items-center gap-1.5 text-gray-500 font-mono text-xs uppercase tracking-widest">
                    <CalendarCheck className="w-3.5 h-3.5" />
                    Last reviewed {formatDate(page.lastReviewed)}
                  </span>
                )}
              </div>

              <h1 className="text-4xl md:text-6xl font-serif leading-[1.1] tracking-tight bg-gradient-to-br from-white via-white to-gray-400 bg-clip-text text-transparent">
                {page.title}
              </h1>
            </header>

            <div className="wiki-prose" dangerouslySetInnerHTML={{ __html: html }} />

            {page.sources.length > 0 && (
              <section className="mt-16 pt-8 border-t border-white/10">
                <h2 className="text-sm font-mono uppercase tracking-widest text-gray-500 mb-4">Sources</h2>
                <ul className="space-y-2">
                  {page.sources.map((source, i) => (
                    <li key={i} className="text-sm">
                      {source.url ? (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-300 hover:text-[#ccff00] transition-colors duration-300"
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
              <section className="mt-12 pt-8 border-t border-white/10">
                <h2 className="inline-flex items-center gap-2 text-sm font-mono uppercase tracking-widest text-gray-500 mb-6">
                  <Link2 className="w-4 h-4" />
                  Referenced by
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {backlinks.map((link) => (
                    <Link
                      key={link.slug}
                      href={`/wiki/${link.slug}`}
                      className="group block p-5 bg-white/[0.03] border border-white/10 rounded-xl hover:border-[#ccff00]/50 transition-all duration-300"
                    >
                      <h3 className="text-base font-semibold text-white group-hover:text-[#ccff00] transition-colors duration-300 mb-1">
                        {link.title}
                      </h3>
                      <p className="text-sm text-gray-400 leading-relaxed line-clamp-2">{link.summary}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </article>
        </main>

        <Footer />
      </div>
    </div>
  );
}
