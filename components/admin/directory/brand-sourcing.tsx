'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Loader2, Sparkles, CheckCircle2, AlertTriangle, Globe2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SourcingResponse {
  ok: boolean;
  summary?: string;
  found_brands: number;
  brand_names?: string[];
  brands: { created: number; linked: number; errors: Array<{ row: number; brand?: string; error: string }> };
  products: { created: number; linked: number; errors: Array<{ row: number; brand?: string; error: string }> };
}

const CATEGORY_NONE = '__any__';
const CERT_OPTIONS = ['B Corp', 'Organic', 'Carbon neutral', 'Fairtrade', 'Regenerative'];

export function BrandSourcing() {
  const [mode, setMode] = useState<'filter' | 'manual'>('filter');
  const [category, setCategory] = useState(CATEGORY_NONE);
  const [country, setCountry] = useState('');
  const [keywords, setKeywords] = useState('');
  const [certs, setCerts] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(12);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SourcingResponse | null>(null);

  function toggleCert(c: string) {
    setCerts((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const payload =
        mode === 'manual'
          ? { query: query.trim(), limit }
          : {
              category: category === CATEGORY_NONE ? undefined : category,
              country: country.trim() || undefined,
              keywords: keywords.trim() || undefined,
              certifications: Array.from(certs),
              limit,
            };
      const res = await fetch('/api/admin/directory/sourcing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as SourcingResponse & {
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        setError(body.detail ?? body.error ?? `HTTP ${res.status}`);
        return;
      }
      setResult(body);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setBusy(false);
    }
  }

  const canRun =
    mode === 'manual'
      ? query.trim().length > 0
      : category !== CATEGORY_NONE || !!country.trim() || !!keywords.trim() || certs.size > 0;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/60 bg-card/40 p-5 space-y-4">
        <div className="flex gap-2">
          <ModeTab active={mode === 'filter'} onClick={() => setMode('filter')} label="Search by filters" />
          <ModeTab active={mode === 'manual'} onClick={() => setMode('manual')} label="Find a specific brand" />
        </div>

        {mode === 'filter' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Category">
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="bg-background/40 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CATEGORY_NONE}>Any category</SelectItem>
                    <SelectItem value="spirits">Spirits</SelectItem>
                    <SelectItem value="wine">Wine</SelectItem>
                    <SelectItem value="beer">Beer</SelectItem>
                    <SelectItem value="non_alc">Non-alcoholic</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Country">
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g. United Kingdom"
                  className="w-full px-3 py-2 rounded-md border border-border/60 bg-background/40 text-sm h-9 focus:outline-none focus:border-neon-lime focus:ring-1 focus:ring-neon-lime"
                />
              </Field>
              <Field label="Keywords">
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="e.g. small-batch gin"
                  className="w-full px-3 py-2 rounded-md border border-border/60 bg-background/40 text-sm h-9 focus:outline-none focus:border-neon-lime focus:ring-1 focus:ring-neon-lime"
                />
              </Field>
            </div>
            <Field label="Sustainability credentials (optional)">
              <div className="flex flex-wrap gap-2 pt-1">
                {CERT_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCert(c)}
                    className={`text-[11px] rounded-full border px-2.5 py-1 transition-colors ${
                      certs.has(c)
                        ? 'bg-neon-lime/15 border-neon-lime/40 text-neon-lime'
                        : 'border-border/60 text-muted-foreground hover:border-neon-lime/40'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        ) : (
          <Field label="Brand name">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Avallen, Nc'nean, Two Drifters Rum"
                className="w-full pl-9 pr-3 py-2 rounded-md border border-border/60 bg-background/40 text-sm h-9 focus:outline-none focus:border-neon-lime focus:ring-1 focus:ring-neon-lime"
              />
            </div>
          </Field>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Max results</span>
            <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger className="bg-background/40 h-8 w-20 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 12, 20, 25].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={run}
            disabled={!canRun || busy}
            className="bg-neon-lime hover:bg-neon-lime/90 text-black font-semibold"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Searching the web…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-1.5" /> Find brands
              </>
            )}
          </Button>
        </div>
        {busy && (
          <p className="text-[11px] text-muted-foreground">
            This can take 20-60 seconds while we search the web and pull together brand profiles.
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {result && <ResultPanel result={result} />}
    </div>
  );
}

function ResultPanel({ result }: { result: SourcingResponse }) {
  if (result.found_brands === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/40 p-6 text-sm text-muted-foreground">
        No matching brands found. {result.summary}
      </div>
    );
  }
  const added = result.brands.created;
  const linked = result.brands.linked;
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-3">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-300 shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-semibold">
            Found {result.found_brands} brand{result.found_brands === 1 ? '' : 's'} ·{' '}
            {added} added, {linked} already in the directory
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {result.products.created + result.products.linked > 0 && (
              <>
                {result.products.created} new product
                {result.products.created === 1 ? '' : 's'} added.{' '}
              </>
            )}
            New entries are <strong>pending</strong> — review and verify them before they go
            live.
          </div>
          {result.summary && (
            <p className="text-[11px] text-muted-foreground mt-2 italic">{result.summary}</p>
          )}
        </div>
      </div>

      {result.brand_names && result.brand_names.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 pt-1">
          {result.brand_names.map((n) => (
            <li
              key={n}
              className="inline-flex items-center gap-1 text-[11px] rounded-full border border-border/60 bg-background/40 px-2.5 py-1"
            >
              <Globe2 className="h-3 w-3 text-muted-foreground" />
              {n}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 pt-1">
        <Button asChild size="sm" className="bg-neon-lime hover:bg-neon-lime/90 text-black font-semibold">
          <Link href="/admin/directory/review">Review &amp; verify →</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/directory/brands?verification=pending">View pending brands</Link>
        </Button>
      </div>

      {(result.brands.errors.length > 0 || result.products.errors.length > 0) && (
        <div className="text-[11px] text-amber-300 pt-1">
          {result.brands.errors.length + result.products.errors.length} row
          {result.brands.errors.length + result.products.errors.length === 1 ? '' : 's'} skipped
          (e.g. unresolved brand or empty name).
        </div>
      )}
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-semibold rounded-md px-3 py-1.5 transition-colors ${
        active
          ? 'bg-neon-lime/15 border border-neon-lime/40 text-neon-lime'
          : 'border border-border/60 text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </span>
      {children}
    </div>
  );
}
