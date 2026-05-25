'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ListChecks,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ResolvedLine {
  line: string;
  status: 'linked' | 'created' | 'alkatera_linked' | 'invalid';
  brand_name: string | null;
  directory_id: string | null;
  match_via: 'exact_name' | 'alias' | 'fuzzy' | 'created' | 'alkatera_org' | null;
  error?: string;
}

interface ListResponse {
  counts: {
    total: number;
    created: number;
    linked: number;
    alkatera_linked?: number;
    invalid: number;
  };
  resolved: ResolvedLine[];
  scrape_enqueue?: { queued: number; skipped_no_website: number; skipped_already_queued: number };
}

export function IntakeListPanel() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ListResponse | null>(null);

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/admin/directory/intake/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines }),
      });
      const json = (await res.json().catch(() => ({}))) as
        | (ListResponse & { error?: string; detail?: string })
        | { error?: string; detail?: string };
      if (!res.ok || !('counts' in json)) {
        setError(
          (json as { detail?: string; error?: string }).detail ??
            (json as { detail?: string; error?: string }).error ??
            `HTTP ${res.status}`,
        );
        setBusy(false);
        return;
      }
      setResult(json as ListResponse);
      setText('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/60 bg-card/40 p-5 space-y-4">
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Paste brand names or URLs, one per line
          </span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Avallen Spirits\nNc'nean Distillery\nhttps://www.twodriftersrum.com\nlochlea.co.uk`}
            rows={10}
            className="w-full px-3 py-2 rounded-md border border-border/60 bg-background/40 text-sm font-mono leading-relaxed resize-y focus:outline-none focus:border-neon-lime focus:ring-1 focus:ring-neon-lime"
          />
          <p className="text-[11px] text-muted-foreground">
            Names match against the directory by exact / alias / fuzzy similarity. URLs land with
            the website filled in so the auto-scrape pass enriches them. Up to 500 lines per
            submit.
          </p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted-foreground">
            {lines.length} line{lines.length === 1 ? '' : 's'} ready
          </span>
          <Button
            onClick={run}
            disabled={busy || lines.length === 0}
            className="bg-neon-lime hover:bg-neon-lime/90 text-black font-semibold"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Adding…
              </>
            ) : (
              <>
                <ListChecks className="h-4 w-4 mr-1.5" /> Add to directory
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {result && <ListResultPanel result={result} />}
    </div>
  );
}

function ListResultPanel({ result }: { result: ListResponse }) {
  const { counts, resolved } = result;
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-3">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-300 shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-semibold">
            {counts.created} created, {counts.linked} linked
            {counts.alkatera_linked && counts.alkatera_linked > 0 ? (
              <> ({counts.alkatera_linked} via alka<strong>tera</strong> customer match)</>
            ) : null}
            {counts.invalid > 0 && <>, {counts.invalid} couldn't be parsed</>}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            New entries land pending.{' '}
            {result.scrape_enqueue && result.scrape_enqueue.queued > 0 ? (
              <>
                {result.scrape_enqueue.queued} brand-website scrape
                {result.scrape_enqueue.queued === 1 ? '' : 's'} queued.
              </>
            ) : (
              <>Auto-scrape will run against any entry with a website.</>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button asChild size="sm" className="bg-neon-lime hover:bg-neon-lime/90 text-black font-semibold">
          <Link href="/admin/directory/review">Review &amp; verify →</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/directory/brands?verification=pending">View pending brands</Link>
        </Button>
      </div>

      <div className="rounded-lg border border-border/60 bg-background/40 max-h-72 overflow-y-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-card/60 sticky top-0">
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2">Line</th>
              <th className="px-3 py-2">Result</th>
              <th className="px-3 py-2">Via</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {resolved.map((r, i) => (
              <tr key={i} className="border-t border-border/40">
                <td className="px-3 py-1.5 font-mono text-[11px] truncate max-w-[260px]" title={r.line}>
                  {r.line}
                </td>
                <td className="px-3 py-1.5">
                  <StatusPill status={r.status} />
                  {r.brand_name && r.brand_name !== r.line && (
                    <span className="ml-2 text-muted-foreground">{r.brand_name}</span>
                  )}
                  {r.error && <span className="ml-2 text-amber-300">{r.error}</span>}
                </td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  {r.match_via ?? '—'}
                </td>
                <td className="px-3 py-1.5">
                  {r.directory_id && (
                    <Link
                      href={`/admin/directory/brands/${r.directory_id}`}
                      className="inline-flex items-center gap-1 text-neon-lime hover:text-neon-lime/80"
                    >
                      Open <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({
  status,
}: {
  status: 'linked' | 'created' | 'alkatera_linked' | 'invalid';
}) {
  const styles =
    status === 'created'
      ? 'bg-neon-lime/15 border-neon-lime/40 text-neon-lime'
      : status === 'alkatera_linked'
        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
        : status === 'linked'
          ? 'bg-sky-400/15 border-sky-400/40 text-sky-300'
          : 'bg-amber-300/15 border-amber-300/40 text-amber-300';
  const label = status === 'alkatera_linked' ? 'alkatera' : status;
  return <span className={`text-[10px] rounded-full border px-2 py-0.5 ${styles}`}>{label}</span>;
}
