'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, Sparkles, CheckCircle2, AlertTriangle, Globe2 } from 'lucide-react';
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
  brands: {
    created: number;
    linked: number;
    alkatera_linked?: number;
    errors: Array<{ row: number; brand?: string; error: string }>;
  };
  products: { created: number; linked: number; errors: Array<{ row: number; brand?: string; error: string }> };
  scrape_enqueue?: { queued: number; skipped_no_website: number; skipped_already_queued: number };
}

interface BatchProgress {
  chunks_run: number;
  chunks_target: number;
  found: number;
  duplicates_skipped: number;
  zero_streak: number;
  last_chunk_added: number;
}

const CATEGORY_NONE = '__any__';
const CERT_OPTIONS = ['B Corp', 'Organic', 'Carbon neutral', 'Fairtrade', 'Regenerative'];
const TARGET_PRESETS = [12, 25, 50, 100, 200, 300];

export function BrandSourcing() {
  const [mode, setMode] = useState<'filter' | 'manual'>('filter');
  const [category, setCategory] = useState(CATEGORY_NONE);
  const [country, setCountry] = useState('');
  const [keywords, setKeywords] = useState('');
  const [certs, setCerts] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  const [targetCount, setTargetCount] = useState(12);

  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SourcingResponse | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  function toggleCert(c: string) {
    setCerts((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  async function run() {
    cancelledRef.current = false;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(null);
    setPhase('Queued…');
    try {
      const payload =
        mode === 'manual'
          ? { query: query.trim(), target_count: 1 }
          : {
              category: category === CATEGORY_NONE ? undefined : category,
              country: country.trim() || undefined,
              keywords: keywords.trim() || undefined,
              certifications: Array.from(certs),
              target_count: targetCount,
            };
      const res = await fetch('/api/admin/directory/sourcing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as {
        jobId?: string;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !body.jobId) {
        setError(body.detail ?? body.error ?? `HTTP ${res.status}`);
        setBusy(false);
        setPhase(null);
        return;
      }
      await pollJob(body.jobId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setBusy(false);
      setPhase(null);
    }
  }

  async function pollJob(jobId: string) {
    // Poll up to 15 minutes — a 300-brand batch can run 8-12 chunks of
    // ~60s each plus an ingest pass at the end. 3s interval.
    const deadline = Date.now() + 15 * 60 * 1000;
    while (!cancelledRef.current && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      if (cancelledRef.current) return;
      let body: {
        status?: string;
        phase_message?: string | null;
        result?: SourcingResponse;
        error?: string;
        progress?: BatchProgress;
      };
      try {
        const res = await fetch(`/api/admin/directory/sourcing/${jobId}`);
        body = await res.json();
      } catch {
        continue; // transient — keep polling
      }
      if (body.phase_message) setPhase(body.phase_message);
      if (body.progress) setProgress(body.progress);
      if (body.status === 'done' && body.result) {
        setResult(body.result);
        setBusy(false);
        setPhase(null);
        return;
      }
      if (body.status === 'error') {
        setError(body.error ?? 'Search failed');
        setBusy(false);
        setPhase(null);
        return;
      }
    }
    if (!cancelledRef.current) {
      setError('Timed out waiting for results. The search may still finish — check Pending brands shortly.');
      setBusy(false);
      setPhase(null);
    }
  }

  const canRun =
    mode === 'manual'
      ? query.trim().length > 0
      : category !== CATEGORY_NONE || !!country.trim() || !!keywords.trim() || certs.size > 0;

  return (
    <div className="space-y-6">
      <div className="rounded-[6px] border border-border bg-card p-5 space-y-4">
        <div className="flex gap-2">
          <ModeTab active={mode === 'filter'} onClick={() => setMode('filter')} label="Search by filters" />
          <ModeTab active={mode === 'manual'} onClick={() => setMode('manual')} label="Find a specific brand" />
        </div>

        {mode === 'filter' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Category">
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="bg-secondary h-9 text-sm">
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
                  className="w-full px-3 py-2 rounded-[6px] border border-border bg-secondary text-sm h-9 focus:outline-none focus:border-foreground focus:ring-1 focus:ring-foreground"
                />
              </Field>
              <Field label="Keywords">
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="e.g. small-batch gin"
                  className="w-full px-3 py-2 rounded-[6px] border border-border bg-secondary text-sm h-9 focus:outline-none focus:border-foreground focus:ring-1 focus:ring-foreground"
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
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:border-foreground'
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
                className="w-full pl-9 pr-3 py-2 rounded-[6px] border border-border bg-secondary text-sm h-9 focus:outline-none focus:border-foreground focus:ring-1 focus:ring-foreground"
              />
            </div>
          </Field>
        )}

        {mode === 'filter' && (
          <div className="space-y-1 pt-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              How many brands?
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {TARGET_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setTargetCount(n)}
                  className={`text-[11px] rounded-full border px-3 py-1 transition-colors ${
                    targetCount === n
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-foreground'
                  }`}
                >
                  {n}
                </button>
              ))}
              <span className="text-[11px] text-muted-foreground">
                Chunked into ≤25 per web-search call. Up to 300 per brief.
              </span>
            </div>
          </div>
        )}
        <div className="flex items-center justify-end gap-3 pt-1">
          <Button
            onClick={run}
            disabled={!canRun || busy}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
          >
            {busy ? (
              'Searching the web…'
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-1.5" /> Find brands
              </>
            )}
          </Button>
        </div>
        {busy && (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              {phase ?? 'Working…'} Larger briefs can run for several minutes while we chunk the
              web search. You can leave this page open.
            </p>
            {progress && progress.chunks_target > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>
                    Chunk {progress.chunks_run} / {progress.chunks_target}
                  </span>
                  <span>
                    {progress.found} brand{progress.found === 1 ? '' : 's'} found
                    {progress.duplicates_skipped > 0 && (
                      <>
                        {' '}
                        · {progress.duplicates_skipped} duplicate{progress.duplicates_skipped === 1 ? '' : 's'}
                      </>
                    )}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-[#6F6F68] transition-[width] duration-500"
                    style={{
                      width: `${Math.min(100, (progress.chunks_run / progress.chunks_target) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-[6px] border border-border bg-card px-4 py-3 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-studio-stale shrink-0 mt-0.5" />
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
      <div className="rounded-[6px] border border-border bg-card p-6 text-sm text-muted-foreground">
        No matching brands found. {result.summary}
      </div>
    );
  }
  const added = result.brands.created;
  const linked = result.brands.linked;
  const alkateraLinked = result.brands.alkatera_linked ?? 0;
  return (
    <div className="rounded-[6px] border border-border bg-card p-5 space-y-3">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-studio-good shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-semibold">
            Found {result.found_brands} brand{result.found_brands === 1 ? '' : 's'} ·{' '}
            {added} added, {linked} already in the directory
            {alkateraLinked > 0 && (
              <>
                {' '}
                · {alkateraLinked} matched an existing alka<strong>tera</strong> customer
              </>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {result.products.created + result.products.linked > 0 && (
              <>
                {result.products.created} new product
                {result.products.created === 1 ? '' : 's'} added.{' '}
              </>
            )}
            {result.scrape_enqueue && result.scrape_enqueue.queued > 0 && (
              <>
                {result.scrape_enqueue.queued} brand-website scrape
                {result.scrape_enqueue.queued === 1 ? '' : 's'} queued for first-pass
                enrichment.{' '}
              </>
            )}
            New entries are <strong>pending</strong>: review and verify them before they go
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
              className="inline-flex items-center gap-1 text-[11px] rounded-full border border-border bg-secondary px-2.5 py-1"
            >
              <Globe2 className="h-3 w-3 text-muted-foreground" />
              {n}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 pt-1">
        <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
          <Link href="/admin/directory/review">Review &amp; verify →</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/directory/brands?verification=pending">View pending brands</Link>
        </Button>
      </div>

      {(result.brands.errors.length > 0 || result.products.errors.length > 0) && (
        <div className="text-[11px] text-studio-attention pt-1">
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
      className={`text-xs font-semibold rounded-[6px] px-3 py-1.5 transition-colors ${
        active
          ? 'bg-primary text-primary-foreground border border-primary'
          : 'border border-border text-muted-foreground hover:text-foreground'
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
