'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DeepEnrichResponse {
  ok: true;
  summary: string | null;
  products: { created: number; linked: number; errors: string[] };
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
  const [result, setResult] = useState<DeepEnrichResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/directory/brands/${brandId}/deep-enrich`, {
        method: 'POST',
      });
      const body = (await res.json().catch(() => ({}))) as
        | DeepEnrichResponse
        | { error?: string; detail?: string };
      if (!res.ok || !('ok' in body)) {
        setError(
          (body as { detail?: string; error?: string }).detail ??
            (body as { detail?: string; error?: string }).error ??
            `HTTP ${res.status}`,
        );
        return;
      }
      setResult(body);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Enrich failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-sky-500/30 bg-gradient-to-br from-sky-500/5 via-card/40 to-card/40 p-5 space-y-4">
      <div>
        <div className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-sky-300" />
          Deep enrich with web search
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          One-shot pass that searches the web for {brandName}'s products and any sustainability
          documents (EPDs, LCAs, impact reports). PDF URLs get downloaded and queued for the
          document processor. Use when the crawler misses things — JS-heavy sites or docs hosted
          on third-party platforms.
          {!hasWebsite && (
            <>
              {' '}
              <span className="text-amber-300">
                No website on file yet — results will be best with one set.
              </span>
            </>
          )}
        </p>
      </div>

      <Button
        onClick={run}
        disabled={busy}
        className="bg-sky-400 hover:bg-sky-400/90 text-black font-semibold"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Searching the web…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-1.5" /> Deep enrich
          </>
        )}
      </Button>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-semibold">
                {result.products.created} new product
                {result.products.created === 1 ? '' : 's'},{' '}
                {result.products.linked} linked
                {result.documents.ingested > 0 && (
                  <>
                    {' '}
                    · {result.documents.ingested} document
                    {result.documents.ingested === 1 ? '' : 's'} queued for processing
                  </>
                )}
              </div>
              {result.summary && (
                <div className="text-[11px] italic text-muted-foreground">{result.summary}</div>
              )}
              {result.enrich_error && (
                <div className="text-[11px] text-amber-300">{result.enrich_error}</div>
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
                        ? 'text-emerald-300'
                        : d.status === 'failed'
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                    }`}
                  />
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-neon-lime truncate flex-1 min-w-0"
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
