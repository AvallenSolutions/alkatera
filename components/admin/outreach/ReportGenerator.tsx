'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Copy, Check, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PRODUCT_TYPE_OPTIONS } from '@/lib/industry-benchmarks';

interface GenerateResult {
  id: string;
  token: string;
  path: string;
  url: string;
  enrichmentDispatched: boolean;
  enrichmentRequested: boolean;
}

interface ReportRow {
  id: string;
  token: string;
  brand_name: string;
  category: string | null;
  status: string;
  enrichment_status: string;
  created_at: string;
}

interface FunnelStats {
  generated: number;
  viewed: number;
  claimed: number;
}

function pct(part: number, whole: number): string {
  if (!whole) return '0%';
  return `${Math.round((part / whole) * 100)}%`;
}

export function ReportGenerator() {
  const [brandName, setBrandName] = useState('');
  const [website, setWebsite] = useState('');
  const [category, setCategory] = useState('');
  const [country, setCountry] = useState('');
  const [autoEnrich, setAutoEnrich] = useState(true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [resultBrand, setResultBrand] = useState('');
  const [copied, setCopied] = useState(false);
  // Gate the "ready to send" state on enrichment actually finishing.
  const [enrichState, setEnrichState] = useState<'researching' | 'ready' | 'failed'>('ready');

  const [reports, setReports] = useState<ReportRow[]>([]);
  const [stats, setStats] = useState<FunnelStats | null>(null);

  const loadReports = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/outreach/reports');
      if (!res.ok) return;
      const body = (await res.json()) as { reports: ReportRow[]; stats?: FunnelStats };
      setReports(body.reports ?? []);
      setStats(body.stats ?? null);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  async function generate() {
    if (!brandName.trim()) {
      setError('Brand name is required');
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      const res = await fetch('/api/admin/outreach/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName: brandName.trim(),
          website: website.trim() || null,
          category: category || null,
          countryOfOrigin: country.trim() || null,
          autoEnrich,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((body as { error?: string }).error ?? `Failed (${res.status})`);
        return;
      }
      const r = body as GenerateResult;
      setResult(r);
      setResultBrand(brandName.trim());
      // If enrichment was dispatched, the report isn't trustworthy until it
      // finishes — gate the link behind a poll. Otherwise it's the typed-input
      // estimate the user explicitly chose, so it's ready now.
      setEnrichState(r.enrichmentDispatched ? 'researching' : 'ready');
      void loadReports();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setBusy(false);
    }
  }

  // Poll the report's enrichment status while it's being researched.
  useEffect(() => {
    if (!result || enrichState !== 'researching') return;
    let cancelled = false;
    let tries = 0;
    const tick = async () => {
      tries += 1;
      try {
        const res = await fetch('/api/admin/outreach/reports');
        if (res.ok) {
          const body = (await res.json()) as { reports: ReportRow[]; stats?: FunnelStats };
          setReports(body.reports ?? []);
          setStats(body.stats ?? null);
          const row = (body.reports ?? []).find((x) => x.id === result.id);
          if (row?.enrichment_status === 'done') {
            if (!cancelled) setEnrichState('ready');
            return;
          }
          if (row?.enrichment_status === 'failed') {
            if (!cancelled) setEnrichState('failed');
            return;
          }
        }
      } catch {
        /* keep polling */
      }
      if (!cancelled && tries < 40) setTimeout(tick, 3000);
    };
    const first = setTimeout(tick, 2000);
    return () => {
      cancelled = true;
      clearTimeout(first);
    };
  }, [result, enrichState]);

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Could not copy to clipboard');
    }
  }

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-border/60 bg-card/40 p-4 sm:p-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Generated</div>
            <div className="mt-1 text-3xl font-bold">{stats.generated}</div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/40 p-4 sm:p-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Opened</div>
            <div className="mt-1 text-3xl font-bold">{stats.viewed}</div>
            <div className="text-xs text-muted-foreground">{pct(stats.viewed, stats.generated)} open rate</div>
          </div>
          <div className="rounded-2xl border border-neon-lime/30 bg-neon-lime/5 p-4 sm:p-5">
            <div className="text-[11px] uppercase tracking-wider text-neon-lime">Claimed</div>
            <div className="mt-1 text-3xl font-bold">{stats.claimed}</div>
            <div className="text-xs text-muted-foreground">{pct(stats.claimed, stats.generated)} of generated</div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border/60 bg-card/40 p-5 sm:p-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="brandName">Brand name *</Label>
            <Input
              id="brandName"
              placeholder="e.g. Avallen"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="website">Website (optional)</Label>
            <Input
              id="website"
              placeholder="https://avallenspirits.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category">Category (optional)</Label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Infer automatically</option>
              {PRODUCT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="country">Country of origin (optional)</Label>
            <Input
              id="country"
              placeholder="e.g. France"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={autoEnrich}
            onChange={(e) => setAutoEnrich(e.target.checked)}
            className="h-4 w-4 accent-[#ccff00]"
          />
          Auto-enrich in the background (searches the web to sharpen the estimate)
        </label>

        <div className="flex items-center gap-3">
          <Button onClick={generate} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…
              </>
            ) : (
              'Generate report link'
            )}
          </Button>
          {error && <span className="text-sm text-destructive">{error}</span>}
        </div>

        {result && enrichState === 'researching' && (
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 space-y-2">
            <div className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Researching {resultBrand || 'the brand'}…
            </div>
            <p className="text-xs text-muted-foreground">
              Reading the brand&apos;s website to find the real category and product sizes. This
              usually takes under a minute. <strong>Hold off on sending</strong> until the link is
              ready — the report isn&apos;t brand-specific yet.
            </p>
          </div>
        )}

        {result && enrichState === 'ready' && (
          <div className="rounded-xl border border-neon-lime/30 bg-neon-lime/5 p-4 space-y-3">
            <div className="text-sm font-semibold text-foreground">Link ready. Paste it into your email.</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md bg-background/70 border border-border/60 px-3 py-2 text-sm">
                {result.url}
              </code>
              <Button variant="outline" size="sm" onClick={() => copyLink(result.url)}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={result.path} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        )}

        {result && enrichState === 'failed' && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 space-y-3">
            <div className="text-sm font-semibold text-foreground">
              Couldn&apos;t research {resultBrand || 'this brand'} automatically
            </div>
            <p className="text-xs text-muted-foreground">
              The website couldn&apos;t be read, so this report is only a generic estimate, not
              brand-specific. <strong>Best not to send it.</strong> Check the website URL is correct
              and generate again, or fill in the category and country by hand.
            </p>
            <div className="flex items-center gap-2">
              <a
                href={result.path}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1"
              >
                Preview the generic report <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/40 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent reports</h2>
          <Button variant="ghost" size="sm" onClick={() => void loadReports()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reports yet.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {reports.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{r.brand_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.category ?? 'Uncategorised'} · {r.status} · enrich: {r.enrichment_status}
                  </div>
                </div>
                <a
                  href={`/r/${r.token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-neon-lime hover:underline whitespace-nowrap inline-flex items-center gap-1"
                >
                  Open <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
