'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DeepEnrichResponse {
  summary: string | null;
  brand: { fields_updated: number; patch: Record<string, unknown> };
  credentials: { written: number; errors: string[] };
  products: {
    created: number;
    linked: number;
    skipped_by_dedup: number;
    errors: string[];
  };
  documents: {
    ingested: number;
    skipped: number;
    details: Array<{ url: string; status: 'ingested' | 'skipped' | 'failed'; reason?: string }>;
  };
  enrich_error: string | null;
}

interface Props {
  brandId: string;
  brandName: string;
  hasWebsite: boolean;
}

/**
 * Admin "Deep enrich" button. Triggers a Claude + web_search pass that
 * finds products + sustainability documents for the brand across the
 * web (not just the brand's own site). Products go into product_directory;
 * any URLs ending in .pdf get auto-ingested via the doc processor.
 */
export function BrandDeepEnrichControl({ brandId, brandName, hasWebsite }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [result, setResult] = useState<DeepEnrichResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  async function run() {
    cancelledRef.current = false;
    setBusy(true);
    setError(null);
    setResult(null);
    setPhase('Queued…');
    try {
      const res = await fetch(`/api/admin/directory/brands/${brandId}/deep-enrich`, {
        method: 'POST',
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
      setError(err instanceof Error ? err.message : 'Enrich failed');
      setBusy(false);
      setPhase(null);
    }
  }

  async function pollJob(jobId: string) {
    // Up to 15 minutes — the bg fn has a 15-min window. 3s interval.
    const deadline = Date.now() + 15 * 60 * 1000;
    while (!cancelledRef.current && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      if (cancelledRef.current) return;
      let body: {
        status?: string;
        phase_message?: string | null;
        result?: DeepEnrichResponse;
        error?: string;
      };
      try {
        const res = await fetch(`/api/admin/directory/deep-enrich/${jobId}`);
        body = await res.json();
      } catch {
        continue; // transient — keep polling
      }
      if (body.phase_message) setPhase(body.phase_message);
      if (body.status === 'done' && body.result) {
        setResult(body.result);
        setBusy(false);
        setPhase(null);
        router.refresh();
        return;
      }
      if (body.status === 'error') {
        setError(body.error ?? 'Enrich failed');
        setBusy(false);
        setPhase(null);
        return;
      }
    }
    if (!cancelledRef.current) {
      setError("Timed out waiting for results. The job may still finish, refresh the page to see what landed.");
      setBusy(false);
      setPhase(null);
    }
  }

  return (
    <div className="rounded-[6px] border border-border bg-card p-5 space-y-4">
      <div>
        <div className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          Deep enrich with web search
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          One-shot pass that searches the web for {brandName}'s products and any sustainability
          documents (EPDs, LCAs, impact reports). PDF URLs get downloaded and queued for the
          document processor. Use when the crawler misses things: JS-heavy sites or docs hosted
          on third-party platforms.
          {!hasWebsite && (
            <>
              {' '}
              <span className="text-studio-attention">
                No website on file yet, results will be best with one set.
              </span>
            </>
          )}
        </p>
      </div>

      <Button
        onClick={run}
        disabled={busy}
        className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
      >
        {busy ? (
          'Searching the web…'
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-1.5" /> Deep enrich
          </>
        )}
      </Button>

      {busy && (
        <p className="text-[11px] text-muted-foreground">
          {phase ?? 'Working…'} Multi-source enrichment runs in the background and can take a
          minute or two while we check certifier directories, sustainability databases, and the
          brand's own pages. You can leave this page open.
        </p>
      )}

      {error && (
        <div className="rounded-[6px] border border-border bg-secondary px-3 py-2 text-xs flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-studio-stale shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="rounded-[6px] border border-border bg-secondary px-4 py-3 text-sm flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-studio-good shrink-0 mt-0.5" />
            <div className="space-y-1 min-w-0">
              <div className="font-semibold flex flex-wrap gap-x-3 gap-y-0.5">
                {result.brand.fields_updated > 0 && (
                  <span>
                    {result.brand.fields_updated} brand field
                    {result.brand.fields_updated === 1 ? '' : 's'} filled
                  </span>
                )}
                {result.credentials.written > 0 && (
                  <span>
                    {result.credentials.written} credential
                    {result.credentials.written === 1 ? '' : 's'} recorded
                  </span>
                )}
                <span>
                  {result.products.created} new product
                  {result.products.created === 1 ? '' : 's'}
                </span>
                {result.products.skipped_by_dedup > 0 && (
                  <span className="text-muted-foreground">
                    {result.products.skipped_by_dedup} dedup
                  </span>
                )}
                {result.documents.ingested > 0 && (
                  <span>
                    {result.documents.ingested} document
                    {result.documents.ingested === 1 ? '' : 's'} queued
                  </span>
                )}
              </div>
              {result.summary && (
                <div className="text-[11px] italic text-muted-foreground">{result.summary}</div>
              )}
              {result.enrich_error && (
                <div className="text-[11px] text-studio-attention">{result.enrich_error}</div>
              )}
            </div>
          </div>

          {result.documents.details.length > 0 && (
            <ul className="space-y-1.5 text-[12px]">
              {result.documents.details.map((d, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 border-b border-border/30 last:border-b-0 pb-1.5 last:pb-0"
                >
                  <FileText
                    className={`h-3.5 w-3.5 shrink-0 ${
                      d.status === 'ingested'
                        ? 'text-studio-good'
                        : d.status === 'failed'
                          ? 'text-studio-stale'
                          : 'text-muted-foreground'
                    }`}
                  />
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline truncate flex-1 min-w-0"
                    title={d.url}
                  >
                    {d.url}
                  </a>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                    {d.status}
                    {d.reason ? ` (${d.reason})` : ''}
                  </span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
