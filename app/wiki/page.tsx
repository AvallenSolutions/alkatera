import { Metadata } from 'next';
import Link from 'next/link';
import { Navigation } from '@/marketing/components/Navigation';
import { Footer } from '@/marketing/components/Footer';
import { WikiMapClient } from '@/marketing/components/WikiMapClient';
import { getWikiMapData, WIKI_TYPE_LABELS, WIKI_TYPE_ORDER } from '@/lib/wiki';

// Pages are read from wiki/pages/*.md at build time.
export const dynamic = 'force-static';

const description =
  'Sustainability for the drinks industry on one connected map: carbon accounting, legislation and green claims in plain English. Click anything to explore.';

export const metadata: Metadata = {
  title: 'Sustainability Wiki | alkatera',
  description,
  alternates: {
    canonical: '/wiki',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sustainability Wiki | alkatera',
    description,
  },
};

export default function WikiIndexPage() {
  const nodes = getWikiMapData();

  return (
    <div className="min-h-screen bg-[#050505] text-white relative">
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
        <div className="absolute bottom-[10%] right-[15%] w-[600px] h-[600px] bg-[#00ccff] rounded-full opacity-[0.07] blur-[100px]" />
      </div>

      <div className="relative z-10">
        <Navigation />

        <main className="pt-32 pb-24">
          <div className="max-w-7xl mx-auto px-6">
            <header className="mb-10 space-y-4 max-w-3xl">
              <p className="font-mono text-xs uppercase tracking-widest text-[#ccff00]">
                Sustainability wiki
              </p>
              <h1 className="text-5xl md:text-6xl font-serif leading-[1.1] tracking-tight bg-gradient-to-br from-white via-white to-gray-400 bg-clip-text text-transparent">
                Sustainability, connected
              </h1>
              <p className="text-lg text-gray-400 leading-relaxed">
                Everything a drinks business needs to know, on one map. Click anything to see what
                it is and how it connects, or take a tour.
              </p>
            </header>

            <WikiMapClient nodes={nodes} />

            {/* Crawlable list of every page; the map above is the interactive view. */}
            <section className="mt-24 border-t border-white/10 pt-12">
              <h2 className="mb-8 font-serif text-2xl text-white">Browse as a list</h2>
              <div className="space-y-10">
                {WIKI_TYPE_ORDER.map((type) => {
                  const pages = nodes
                    .filter((n) => n.type === type)
                    .sort((a, b) => a.title.localeCompare(b.title));
                  if (pages.length === 0) return null;
                  return (
                    <div key={type}>
                      <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-[#ccff00]">
                        {WIKI_TYPE_LABELS[type]}
                      </h3>
                      <ul className="grid gap-x-8 gap-y-3 md:grid-cols-2">
                        {pages.map((page) => (
                          <li key={page.slug}>
                            <Link
                              href={`/wiki/${page.slug}`}
                              className="group block text-sm"
                            >
                              <span className="font-medium text-gray-200 transition-colors duration-300 group-hover:text-[#ccff00]">
                                {page.title}
                              </span>
                              <span className="block text-gray-500">{page.summary}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}
