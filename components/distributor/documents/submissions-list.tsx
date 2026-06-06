'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Download, RefreshCw, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface SubmissionRow {
  id: string;
  brand_name: string | null;
  file_name: string;
  document_type: string;
  file_size_bytes: number | null;
  vintage_year: number | null;
  batch_reference: string | null;
  submitter_name: string | null;
  submitter_email: string | null;
  notes: string | null;
  processing_status: string;
  extracted_count: number | null;
  conflicted_count: number | null;
  error_message: string | null;
  created_at: string;
}

interface Props {
  submissions: SubmissionRow[];
  canManage: boolean;
}

const DOC_LABELS: Record<string, string> = {
  lca_report: 'LCA report',
  carbon_report: 'Carbon footprint report',
  water_usage: 'Water usage data',
  sustainability_report: 'Sustainability report',
  packaging_data: 'Packaging data',
  certification: 'Certification',
  esg_report: 'ESG report',
  other: 'Other',
};

const STATUS_COLOURS: Record<string, string> = {
  pending: 'text-muted-foreground border-muted bg-muted/30',
  processing: 'text-sky-300 border-sky-400/30 bg-sky-500/10',
  complete: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  error: 'text-destructive border-destructive/30 bg-destructive/10',
};

const FILTERS = ['all', 'pending', 'processing', 'complete', 'error'] as const;
type Filter = (typeof FILTERS)[number];

export function SubmissionsList({ submissions, canManage }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [statuses, setStatuses] = useState<Record<string, string>>({});

  const rows = useMemo(
    () =>
      submissions.map((s) => ({ ...s, processing_status: statuses[s.id] ?? s.processing_status })),
    [submissions, statuses],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.processing_status] = (c[r.processing_status] ?? 0) + 1;
    return c;
  }, [rows]);

  const visible = filter === 'all' ? rows : rows.filter((r) => r.processing_status === filter);

  async function download(id: string) {
    setBusy(id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/distributor/documents/${id}/download`);
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        setFeedback({ type: 'err', text: `Could not open file (${body.error ?? res.status}).` });
      } else {
        window.open(body.url, '_blank', 'noopener,noreferrer');
      }
    } finally {
      setBusy(null);
    }
  }

  async function retry(id: string) {
    setBusy(id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/distributor/documents/${id}/retry`, { method: 'POST' });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setFeedback({ type: 'err', text: `Could not retry (${body.error ?? res.status}).` });
      } else {
        setStatuses((prev) => ({ ...prev, [id]: 'pending' }));
        setFeedback({ type: 'ok', text: 'Requeued for processing. It will re-run within a couple of minutes.' });
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-background/30 py-12 flex flex-col items-center gap-3 text-sm text-muted-foreground">
        <div className="rounded-lg bg-sky-500/10 border border-sky-400/30 p-3">
          <Inbox className="h-5 w-5 text-sky-300" />
        </div>
        <p className="max-w-xs text-center">
          No documents submitted yet. When a brand uploads documents via their outreach link, they
          appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors capitalize ${
              filter === f
                ? 'border-sky-400/50 bg-sky-500/15 text-sky-200 font-semibold'
                : 'border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            {f} {counts[f] ? `(${counts[f]})` : ''}
          </button>
        ))}
      </div>

      {feedback && (
        <div
          className={`text-xs px-3 py-2 rounded-lg border ${
            feedback.type === 'ok'
              ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10'
              : 'border-destructive/30 text-destructive bg-destructive/10'
          }`}
        >
          {feedback.text}
        </div>
      )}

      <ul className="space-y-3">
        {visible.map((doc) => (
          <li
            key={doc.id}
            className="rounded-xl border border-border/60 bg-gradient-to-br from-sky-500/5 via-card/40 to-card/40 p-4 flex items-start gap-3"
          >
            <div className="rounded-md bg-sky-500/10 border border-sky-400/30 p-2 shrink-0">
              <FileText className="h-4 w-4 text-sky-300" />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{doc.file_name}</div>
                  {doc.brand_name && (
                    <div className="text-xs text-sky-300/90 font-medium">{doc.brand_name}</div>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] uppercase tracking-wider font-semibold ${
                    STATUS_COLOURS[doc.processing_status] ?? 'text-muted-foreground'
                  }`}
                >
                  {doc.processing_status}
                </Badge>
              </div>

              <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span className="text-foreground/80 font-medium">
                  {DOC_LABELS[doc.document_type] ?? doc.document_type}
                </span>
                {doc.vintage_year && <span>· {doc.vintage_year}</span>}
                {doc.batch_reference && <span>· {doc.batch_reference}</span>}
                {doc.file_size_bytes != null && <span>· {formatBytes(doc.file_size_bytes)}</span>}
                {doc.extracted_count != null && doc.extracted_count > 0 && (
                  <span className="text-emerald-300/90 font-medium">
                    · {doc.extracted_count} fields extracted
                  </span>
                )}
                {doc.conflicted_count != null && doc.conflicted_count > 0 && (
                  <span className="text-amber-300/90 font-medium">
                    · {doc.conflicted_count} conflict{doc.conflicted_count === 1 ? '' : 's'}
                  </span>
                )}
              </div>

              <div className="text-xs text-muted-foreground">
                Submitted by{' '}
                <span className="text-foreground/80 font-medium">
                  {doc.submitter_name ?? 'unknown'}
                </span>
                {doc.submitter_email && <> ({doc.submitter_email})</>} ·{' '}
                {new Date(doc.created_at).toLocaleString()}
              </div>

              {doc.processing_status === 'error' && doc.error_message && (
                <div className="text-xs text-destructive/90 bg-destructive/10 border border-destructive/20 rounded-md px-2 py-1 mt-1">
                  {doc.error_message}
                </div>
              )}

              <div className="flex gap-2 pt-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === doc.id}
                  onClick={() => download(doc.id)}
                  className="border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Open file
                </Button>
                {canManage && doc.processing_status === 'error' && (
                  <Button
                    size="sm"
                    disabled={busy === doc.id}
                    onClick={() => retry(doc.id)}
                    className="bg-sky-400 hover:bg-sky-300 text-black font-semibold"
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry processing
                  </Button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
