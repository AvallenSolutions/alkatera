'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface Props {
  brandId: string;
}

type JobStatus = 'queued' | 'running' | 'complete' | 'error' | 'skipped';

interface LatestJob {
  id: string;
  status: JobStatus;
  triggered_by: string;
  started_at: string | null;
  completed_at: string | null;
  sources_attempted: number;
  sources_succeeded: number;
  error_message: string | null;
  created_at: string;
}

interface ApiResponse {
  latest_job: LatestJob | null;
  findings_total: number;
}

const ACTIVE_POLL_MS = 4_000;
const IDLE_POLL_MS = 30_000;

/**
 * Live data-finding status for a single brand. Polls
 * /api/distributor/brands/[id]/finding-status — fast (4s) while a job
 * is queued or running, slow (30s) otherwise. When a job transitions
 * from running → complete/error, also triggers `router.refresh()` so
 * the parent server components re-render with the new findings.
 */
export function FindingStatus({ brandId }: Props) {
  const router = useRouter();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previousStatusRef = useRef<JobStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const res = await fetch(`/api/distributor/brands/${brandId}/finding-status`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          setError(`Status check failed (${res.status})`);
          return;
        }
        const body = (await res.json()) as ApiResponse;
        if (cancelled) return;
        setData(body);
        setError(null);

        const current = body.latest_job?.status ?? null;
        const prev = previousStatusRef.current;
        // Refresh the parent server components when a job has just
        // settled — that's when the Data tab and completeness score
        // will show new content.
        if (
          prev &&
          (prev === 'queued' || prev === 'running') &&
          current &&
          (current === 'complete' || current === 'error')
        ) {
          router.refresh();
        }
        previousStatusRef.current = current;
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'unknown error');
      }
    }

    function schedule() {
      const status = data?.latest_job?.status;
      const active = status === 'queued' || status === 'running';
      const delay = active ? ACTIVE_POLL_MS : IDLE_POLL_MS;
      timer = setTimeout(async () => {
        await poll();
        if (!cancelled) schedule();
      }, delay);
    }

    // Kick off immediately, then schedule next tick.
    (async () => {
      await poll();
      if (!cancelled) schedule();
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  if (!data && !error) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" /> Checking…
      </div>
    );
  }
  if (error) {
    return <div className="text-xs text-destructive">Status unavailable: {error}</div>;
  }
  if (!data) return null;

  const job = data.latest_job;
  const total = data.findings_total;

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      {renderStatus(job)}
      <span className="text-muted-foreground">
        <span className="font-medium text-foreground">{total}</span>{' '}
        finding{total === 1 ? '' : 's'} on file
      </span>
    </div>
  );
}

function renderStatus(job: LatestJob | null) {
  if (!job) {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Search className="h-3 w-3" /> No finds yet
      </span>
    );
  }

  if (job.status === 'queued') {
    return (
      <span className="inline-flex items-center gap-1.5 text-amber-300">
        <Clock className="h-3 w-3" /> Queued for finding…
      </span>
    );
  }
  if (job.status === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sky-300">
        <Loader2 className="h-3 w-3 animate-spin" /> Finding data…
      </span>
    );
  }
  if (job.status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-destructive">
        <AlertCircle className="h-3 w-3" />
        Last find errored
        {job.error_message && (
          <span className="text-muted-foreground/80 truncate max-w-[280px]" title={job.error_message}>
            · {job.error_message.split('\n')[0]}
          </span>
        )}
      </span>
    );
  }

  // complete or skipped
  const when = job.completed_at ? relative(job.completed_at) : relative(job.created_at);
  return (
    <span className="inline-flex items-center gap-1.5 text-emerald-400">
      <CheckCircle2 className="h-3 w-3" />
      Last find {when} · {job.sources_succeeded}/{job.sources_attempted} sources hit
    </span>
  );
}

function relative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
