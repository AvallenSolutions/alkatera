'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  ArrowRight,
  ArrowLeft,
  X,
  ExternalLink,
  CalendarCheck,
  MapPin,
} from 'lucide-react';

// Serialisable shape produced by lib/wiki's getWikiMapData (declared locally so
// this client bundle never touches the server-only module).
export interface WikiMapNode {
  slug: string;
  title: string;
  type: string;
  tags: string[];
  summary: string;
  inShort: string;
  lastReviewed: string;
  sources: { title: string; url: string }[];
  links: string[];
}

interface Band {
  type: string;
  label: string;
  blurb: string;
  accent: string;
}

const BANDS: Band[] = [
  { type: 'guide', label: 'Guides', blurb: 'start here: the big picture', accent: '#ccff00' },
  { type: 'concept', label: 'Core concepts', blurb: 'the ideas behind measuring', accent: '#b388ff' },
  { type: 'standard', label: 'Standards and methods', blurb: 'the rulebooks everyone follows', accent: '#00ccff' },
  { type: 'legislation', label: 'Legislation and compliance', blurb: 'what applies, where and when', accent: '#ffb74d' },
  { type: 'glossary', label: 'Glossary', blurb: 'the terms, decoded', accent: '#7ee787' },
];

const TOURS: { id: string; label: string; stops: string[] }[] = [
  {
    id: 'new',
    label: "I'm new to carbon",
    stops: [
      'carbon-footprint',
      'greenhouse-gases-and-co2e',
      'scope-1-emissions',
      'scope-2-emissions',
      'scope-3-emissions',
      'drinks-carbon-hotspots',
    ],
  },
  {
    id: 'data',
    label: 'Customers want my data',
    stops: [
      'sustainability-reporting',
      'vsme',
      'csrd',
      'primary-vs-secondary-data',
      'product-carbon-footprint',
      'emission-factors',
    ],
  },
  {
    id: 'claims',
    label: 'I want to make green claims',
    stops: [
      'greenwashing',
      'uk-green-claims-code',
      'eu-green-claims-directive',
      'carbon-neutral',
      'net-zero',
      'carbon-offsetting',
    ],
  },
];

interface Edge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function formatDate(isoDate: string): string {
  if (!isoDate) return '';
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function WikiMapClient({ nodes }: { nodes: WikiMapNode[] }) {
  const bySlug = useMemo(() => new Map(nodes.map((n) => [n.slug, n])), [nodes]);
  const bandFor = useMemo(() => {
    const m = new Map<string, Band>();
    for (const band of BANDS) m.set(band.type, band);
    return m;
  }, []);

  // Undirected adjacency: outbound wikilinks plus backlinks.
  const neighbours = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const n of nodes) m.set(n.slug, new Set());
    for (const n of nodes) {
      for (const target of n.links) {
        if (!m.has(target)) continue;
        m.get(n.slug)!.add(target);
        m.get(target)!.add(n.slug);
      }
    }
    return m;
  }, [nodes]);

  const connectionCount = useMemo(() => {
    const pairs = new Set<string>();
    for (const n of nodes) {
      for (const target of n.links) {
        if (bySlug.has(target)) pairs.add([n.slug, target].sort().join('|'));
      }
    }
    return pairs.size;
  }, [nodes, bySlug]);

  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [tour, setTour] = useState<{ id: string; step: number } | null>(null);
  const [edges, setEdges] = useState<Edge[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef(new Map<string, HTMLButtonElement>());

  const scrollPillIntoView = useCallback((slug: string) => {
    pillRefs.current.get(slug)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const selectNode = useCallback(
    (slug: string, opts?: { fromTour?: boolean }) => {
      if (!opts?.fromTour) setTour(null);
      setSelected(slug);
      setQuery('');
      scrollPillIntoView(slug);
    },
    [scrollPillIntoView],
  );

  const reset = useCallback(() => {
    setSelected(null);
    setTour(null);
    setEdges([]);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reset]);

  // Connection curves are drawn between pill centres in container coordinates.
  const recomputeEdges = useCallback(() => {
    const container = containerRef.current;
    const from = selected ? pillRefs.current.get(selected) : null;
    if (!container || !from) {
      setEdges([]);
      return;
    }
    const cRect = container.getBoundingClientRect();
    const f = from.getBoundingClientRect();
    const next: Edge[] = [];
    for (const target of Array.from(neighbours.get(selected!) ?? [])) {
      const el = pillRefs.current.get(target);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      next.push({
        x1: f.left + f.width / 2 - cRect.left,
        y1: f.top + f.height / 2 - cRect.top,
        x2: r.left + r.width / 2 - cRect.left,
        y2: r.top + r.height / 2 - cRect.top,
      });
    }
    setEdges(next);
  }, [selected, neighbours]);

  useLayoutEffect(() => {
    recomputeEdges();
  }, [recomputeEdges]);

  useEffect(() => {
    window.addEventListener('resize', recomputeEdges);
    return () => window.removeEventListener('resize', recomputeEdges);
  }, [recomputeEdges]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return new Set(
      nodes
        .filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n.summary.toLowerCase().includes(q) ||
            n.tags.some((t) => t.toLowerCase().includes(q)),
        )
        .map((n) => n.slug),
    );
  }, [nodes, query]);

  // Which pills stay at full opacity: the selection and its neighbours beat
  // search matches; with neither, everything is active.
  const activeSet = useMemo(() => {
    if (selected) return new Set([selected, ...Array.from(neighbours.get(selected) ?? [])]);
    return matches;
  }, [selected, neighbours, matches]);

  const selectedNode = selected ? bySlug.get(selected) : null;
  const selectedBand = selectedNode ? bandFor.get(selectedNode.type) : null;
  const activeTour = tour ? TOURS.find((t) => t.id === tour.id) : null;

  const startTour = (id: string) => {
    const t = TOURS.find((x) => x.id === id);
    if (!t) return;
    setTour({ id, step: 0 });
    setSelected(t.stops[0]);
    setQuery('');
    scrollPillIntoView(t.stops[0]);
  };

  const stepTour = (delta: number) => {
    if (!tour || !activeTour) return;
    const step = Math.min(Math.max(tour.step + delta, 0), activeTour.stops.length - 1);
    setTour({ id: tour.id, step });
    setSelected(activeTour.stops[step]);
    scrollPillIntoView(activeTour.stops[step]);
  };

  return (
    <div>
      {/* Search + tours */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value) {
                setSelected(null);
                setTour(null);
              }
            }}
            placeholder="Search, e.g. Scope 3, CSRD..."
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-gray-500 transition-colors duration-300 focus:border-[#ccff00]/50 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-widest text-gray-500">Tours:</span>
          {TOURS.map((t) => (
            <button
              key={t.id}
              onClick={(e) => {
                e.stopPropagation();
                startTour(t.id);
              }}
              className={`rounded-full border px-4 py-1.5 font-mono text-xs uppercase tracking-widest transition-all duration-300 ${
                tour?.id === t.id
                  ? 'border-[#ccff00] bg-[#ccff00]/15 text-[#ccff00]'
                  : 'border-white/15 text-gray-400 hover:border-[#ccff00]/60 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active tour bar */}
      {tour && activeTour && selectedNode && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#ccff00]/25 bg-[#ccff00]/[0.06] px-4 py-3">
          <MapPin className="h-4 w-4 text-[#ccff00]" />
          <span className="font-mono text-xs uppercase tracking-widest text-[#ccff00]">
            {activeTour.label}: stop {tour.step + 1} of {activeTour.stops.length}
          </span>
          <span className="text-sm text-gray-300">{selectedNode.title}</span>
          <span className="ml-auto flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                stepTour(-1);
              }}
              disabled={tour.step === 0}
              className="rounded-md border border-white/15 p-1.5 text-gray-300 transition-colors hover:border-[#ccff00]/60 hover:text-white disabled:opacity-30"
              aria-label="Previous stop"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                stepTour(1);
              }}
              disabled={tour.step === activeTour.stops.length - 1}
              className="rounded-md border border-white/15 p-1.5 text-gray-300 transition-colors hover:border-[#ccff00]/60 hover:text-white disabled:opacity-30"
              aria-label="Next stop"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                reset();
              }}
              className="rounded-md border border-white/15 p-1.5 text-gray-300 transition-colors hover:border-[#ccff00]/60 hover:text-white"
              aria-label="Exit tour"
            >
              <X className="h-4 w-4" />
            </button>
          </span>
        </div>
      )}

      {/* The map */}
      <div ref={containerRef} className="relative" onClick={reset}>
        {/* Connection curves */}
        <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full">
          {edges.map((e, i) => {
            const bowY = Math.abs(e.y1 - e.y2) < 40 ? Math.max(e.y1, e.y2) + 44 : (e.y1 + e.y2) / 2;
            return (
              <path
                key={i}
                d={`M ${e.x1} ${e.y1} C ${e.x1} ${bowY}, ${e.x2} ${bowY}, ${e.x2} ${e.y2}`}
                fill="none"
                stroke="#ccff00"
                strokeOpacity={0.35}
                strokeWidth={1.2}
              />
            );
          })}
        </svg>

        {BANDS.map((band) => {
          const bandNodes = nodes
            .filter((n) => n.type === band.type)
            .sort((a, b) => a.title.localeCompare(b.title));
          if (bandNodes.length === 0) return null;
          return (
            <div
              key={band.type}
              className="mb-4 rounded-2xl border border-white/5 bg-white/[0.02] p-5"
            >
              <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span
                  className="font-mono text-xs uppercase tracking-widest"
                  style={{ color: band.accent }}
                >
                  {band.label}
                </span>
                <span className="text-xs text-gray-500">{band.blurb}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {bandNodes.map((n) => {
                  const isSelected = selected === n.slug;
                  const dimmed = activeSet !== null && !activeSet.has(n.slug);
                  return (
                    <button
                      key={n.slug}
                      ref={(el) => {
                        if (el) pillRefs.current.set(n.slug, el);
                        else pillRefs.current.delete(n.slug);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectNode(n.slug);
                      }}
                      style={{
                        borderColor: isSelected ? band.accent : `${band.accent}55`,
                        backgroundColor: isSelected ? `${band.accent}22` : undefined,
                      }}
                      className={`rounded-full border px-3.5 py-1.5 text-sm transition-all duration-200 ${
                        isSelected ? 'text-white' : 'text-gray-300 hover:text-white'
                      } ${dimmed ? 'opacity-20' : ''}`}
                    >
                      {n.title}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Detail drawer */}
        {selectedNode && selectedBand && (
          <aside
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-x-3 bottom-3 z-30 max-h-[65vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0a0a]/95 p-6 shadow-2xl backdrop-blur lg:absolute lg:bottom-auto lg:left-auto lg:right-3 lg:top-3 lg:max-h-[calc(100%-1.5rem)] lg:w-[380px]"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <span
                className="rounded-md border px-3 py-1 font-mono text-xs uppercase tracking-widest"
                style={{
                  color: selectedBand.accent,
                  borderColor: `${selectedBand.accent}55`,
                  backgroundColor: `${selectedBand.accent}15`,
                }}
              >
                {selectedBand.label}
              </span>
              <button
                onClick={reset}
                className="rounded-md p-1 text-gray-500 transition-colors hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <h2 className="mb-2 font-serif text-2xl leading-tight text-white">{selectedNode.title}</h2>
            <p className="mb-3 text-sm font-medium leading-relaxed text-gray-200">
              {selectedNode.summary}
            </p>
            {selectedNode.inShort && selectedNode.inShort !== selectedNode.summary && (
              <p className="mb-4 text-sm leading-relaxed text-gray-400">{selectedNode.inShort}</p>
            )}

            <Link
              href={`/wiki/${selectedNode.slug}`}
              className="group mb-5 inline-flex items-center gap-2 rounded-md border border-[#ccff00]/40 bg-[#ccff00]/10 px-4 py-2 font-mono text-xs uppercase tracking-widest text-[#ccff00] transition-all duration-300 hover:bg-[#ccff00]/20"
            >
              Read the full page
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>

            {(neighbours.get(selectedNode.slug)?.size ?? 0) > 0 && (
              <div className="mb-5">
                <p className="mb-2 font-mono text-xs uppercase tracking-widest text-gray-500">
                  Connects to
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(neighbours.get(selectedNode.slug) ?? [])
                    .map((slug) => bySlug.get(slug))
                    .filter((n): n is WikiMapNode => Boolean(n))
                    .sort((a, b) => a.title.localeCompare(b.title))
                    .map((n) => (
                      <button
                        key={n.slug}
                        onClick={() => selectNode(n.slug)}
                        className="rounded-full border border-white/15 px-2.5 py-1 text-xs text-gray-400 transition-colors hover:border-[#ccff00]/60 hover:text-white"
                      >
                        {n.title}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {selectedNode.sources.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 font-mono text-xs uppercase tracking-widest text-gray-500">
                  From these sources
                </p>
                <ul className="space-y-1.5">
                  {selectedNode.sources.map((s, i) => (
                    <li key={i}>
                      {s.url ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-start gap-1.5 text-sm text-gray-300 transition-colors hover:text-[#ccff00]"
                        >
                          <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          {s.title}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-300">{s.title}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedNode.lastReviewed && (
              <p className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-gray-600">
                <CalendarCheck className="h-3.5 w-3.5" />
                Last reviewed {formatDate(selectedNode.lastReviewed)}
              </p>
            )}
          </aside>
        )}
      </div>

      <p className="mt-4 font-mono text-xs text-gray-600">
        {nodes.length} pages · {connectionCount} connections · Esc or click the background to reset
      </p>
    </div>
  );
}
