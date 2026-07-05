'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';

// Serialisable subset of lib/wiki's WikiPageMeta (no sources/status needed here).
export interface WikiIndexEntry {
  title: string;
  slug: string;
  type: string;
  tags: string[];
  summary: string;
}

interface WikiIndexClientProps {
  pages: WikiIndexEntry[];
  typeLabels: Record<string, string>;
  typeOrder: string[];
}

function WikiCard({ page }: { page: WikiIndexEntry }) {
  return (
    <Link
      href={`/wiki/${page.slug}`}
      className="group block p-6 bg-white/[0.03] border border-white/10 rounded-xl hover:border-[#ccff00]/50 hover:bg-[#ccff00]/[0.03] transition-all duration-300"
    >
      <h3 className="text-lg font-semibold text-white group-hover:text-[#ccff00] transition-colors duration-300 mb-2">
        {page.title}
      </h3>
      <p className="text-sm text-gray-400 leading-relaxed">{page.summary}</p>
    </Link>
  );
}

export function WikiIndexClient({ pages, typeLabels, typeOrder }: WikiIndexClientProps) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return pages.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [pages, query]);

  const grouped = useMemo(() => {
    const byType = new Map<string, WikiIndexEntry[]>();
    for (const page of pages) {
      const list = byType.get(page.type) || [];
      list.push(page);
      byType.set(page.type, list);
    }
    return typeOrder
      .filter((type) => byType.has(type))
      .map((type) => ({ type, label: typeLabels[type] || type, pages: byType.get(type)! }));
  }, [pages, typeLabels, typeOrder]);

  return (
    <div className="space-y-16">
      {/* Search */}
      <div className="relative max-w-xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the wiki, e.g. Scope 3, CSRD, offsetting..."
          className="w-full pl-12 pr-4 py-4 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-[#ccff00]/50 transition-colors duration-300"
        />
      </div>

      {results !== null ? (
        <section>
          <h2 className="text-sm font-mono uppercase tracking-widest text-gray-500 mb-6">
            {results.length} {results.length === 1 ? 'result' : 'results'}
          </h2>
          {results.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((page) => (
                <WikiCard key={page.slug} page={page} />
              ))}
            </div>
          ) : (
            <p className="text-gray-400">
              Nothing found. Try a broader term, or browse the sections below by clearing the search.
            </p>
          )}
        </section>
      ) : (
        grouped.map(({ type, label, pages: sectionPages }) => (
          <section key={type}>
            <h2 className="text-sm font-mono uppercase tracking-widest text-[#ccff00] mb-6">{label}</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sectionPages.map((page) => (
                <WikiCard key={page.slug} page={page} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
