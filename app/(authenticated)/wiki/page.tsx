import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { WikiMapClient } from '@/marketing/components/WikiMapClient';
import { getWikiMapData, WIKI_TYPE_LABELS, WIKI_TYPE_ORDER } from '@/lib/wiki';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { Statement } from '@/components/studio/statement';
import { BigNumber } from '@/components/studio/big-number';
import { Eyebrow } from '@/components/studio/eyebrow';

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
    <div className="space-y-8">
      <Statement eyebrow="THE EVIDENCE · WIKI" headline="The wiki.">
        <BigNumber value={nodes.length} label="PAGES" size="display" />
      </Statement>
      <p className="max-w-3xl text-sm leading-relaxed text-studio-dim">
        Everything a drinks business needs to know, on one map. Click anything to see what it is
        and how it connects, or take a tour.
      </p>

      <WikiMapClient nodes={nodes} />

      {/* Accessible plain-list view of the same pages. */}
      <section className="border-t border-border pt-10">
        <h2 className="mb-8 font-display text-2xl font-bold tracking-tight text-foreground">
          Browse as a list
        </h2>
        <div className="space-y-10">
          {WIKI_TYPE_ORDER.map((type) => {
            const pages = nodes
              .filter((n) => n.type === type)
              .sort((a, b) => a.title.localeCompare(b.title));
            if (pages.length === 0) return null;
            return (
              <div key={type}>
                <Eyebrow className="mb-4">{WIKI_TYPE_LABELS[type]}</Eyebrow>
                <ul className="grid gap-x-8 gap-y-3 md:grid-cols-2">
                  {pages.map((page) => (
                    <li key={page.slug}>
                      <Link href={`/wiki/${page.slug}`} className="group block text-sm">
                        <span className="font-medium text-foreground transition-colors duration-200 group-hover:text-studio-brick">
                          {page.title}
                        </span>
                        <span className="block text-studio-dim">{page.summary}</span>
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
