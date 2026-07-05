import { Metadata } from 'next';
import { Navigation } from '@/marketing/components/Navigation';
import { Footer } from '@/marketing/components/Footer';
import { WikiIndexClient } from '@/marketing/components/WikiIndexClient';
import { getPublishedWikiPages, WIKI_TYPE_LABELS, WIKI_TYPE_ORDER } from '@/lib/wiki';

// Pages are read from wiki/pages/*.md at build time.
export const dynamic = 'force-static';

const description =
  'Plain-English explanations of carbon accounting, sustainability legislation and green claims for the drinks industry. No jargon, no greenwash.';

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
  const pages = getPublishedWikiPages().map(({ title, slug, type, tags, summary }) => ({
    title,
    slug,
    type,
    tags,
    summary,
  }));

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
          <div className="max-w-6xl mx-auto px-6">
            <header className="mb-16 space-y-6 max-w-3xl">
              <p className="font-mono text-xs uppercase tracking-widest text-[#ccff00]">
                Sustainability wiki
              </p>
              <h1 className="text-5xl md:text-6xl font-serif leading-[1.1] tracking-tight bg-gradient-to-br from-white via-white to-gray-400 bg-clip-text text-transparent">
                Sustainability, explained for drinks businesses
              </h1>
              <p className="text-xl text-gray-400 leading-relaxed">
                {pages.length} plain-English reference pages covering carbon accounting, legislation
                and certification. Every page links to the pages around it, so you can start
                anywhere and follow the thread.
              </p>
            </header>

            <WikiIndexClient pages={pages} typeLabels={WIKI_TYPE_LABELS} typeOrder={WIKI_TYPE_ORDER} />
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}
