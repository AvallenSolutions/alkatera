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

export function ReportGenerator() {
  const [brandName, setBrandName] = useState('');
  const [website, setWebsite] = useState('');
  const [category, setCategory] = useState('');
  const [country, setCountry] = useState('');
  const [autoEnrich, setAutoEnrich] = useState(true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [copied, setCopied] = useState(false);

  const [reports, setReports] = useState<ReportRow[]>([]);

  const loadReports = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/outreach/reports');
      if (!res.ok) return;
      const body = (await res.json()) as { reports: ReportRow[] };
      setReports(body.reports ?? []);
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
      setResult(body as GenerateResult);
      void loadReports();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setBusy(false);
    }
  }

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

        {result && (
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
            <p className="text-xs text-muted-foreground">
              {result.enrichmentRequested
                ? result.enrichmentDispatched
                  ? 'Auto-enrich is running in the background; the report will sharpen within a minute or two. The link stays the same.'
                  : 'Auto-enrich was requested but the background queue is not configured in this environment, so the report uses the typed inputs only.'
                : 'Generated from the typed inputs (no auto-enrich requested).'}
            </p>
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
