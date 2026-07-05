import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { WikiMapClient } from '@/marketing/components/WikiMapClient';
import { getWikiMapData, WIKI_TYPE_LABELS, WIKI_TYPE_ORDER } from '@/lib/wiki';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

// Subscriber-only tool: server-side session gate here, tier/lifecycle handling
// (trial banner, cancelled read-only paywall, suspended redirect) comes from
// AppLayout like every other app page. Reads wiki/pages from disk at request
// time; next.config.js traces the folder into this route's bundle.

export const metadata: Metadata = {
  title: 'Sustainability Wiki | alkatera',
  robots: { index: false, follow: false },
};

export default async function WikiIndexPage() {
  const supabase = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const nodes = getWikiMapData();

  return (
    <div className="p-6">
      <header className="mb-8 max-w-3xl space-y-3">
        <h1 className="font-serif text-4xl leading-tight tracking-tight text-white">
          Sustainability, connected
        </h1>
        <p className="text-gray-400">
          Everything a drinks business needs to know, on one map. Click anything to see what it is
          and how it connects, or take a tour.
        </p>
      </header>

      <WikiMapClient nodes={nodes} />

      {/* Accessible plain-list view of the same pages. */}
      <section className="mt-20 border-t border-white/10 pt-10">
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
                      <Link href={`/wiki/${page.slug}`} className="group block text-sm">
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
  );
}
