'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, FlaskConical } from 'lucide-react';

interface EnrichSnapshot {
  id: string;
  status: string;
  phase_message: string | null;
  enriched: unknown;
  result: unknown;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

interface Props {
  job: EnrichSnapshot | null;
}

/**
 * Collapsible admin diagnostic that surfaces the most recent
 * deep_enrich_jobs row for the brand. Lets us see exactly what
 * Claude returned (the enriched jsonb) vs what landed in the DB
 * (the result jsonb summary), which is the only way to tell whether
 * a missing credential was Claude's fault, the sanitiser's fault,
 * or the persistence layer's.
 *
 * Closed by default. Renders nothing when there's no recent run.
 */
export function BrandEnrichDiagnostic({ job }: Props) {
  const [open, setOpen] = useState(false);
  if (!job) return null;

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="rounded-xl border border-dashed border-border/60 bg-card/30 p-4"
    >
      <summary className="cursor-pointer text-sm font-semibold flex items-center gap-2 list-none">
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <FlaskConical className="h-4 w-4 text-muted-foreground" />
        Last enrich diagnostic
        <span className="text-[11px] font-normal text-muted-foreground">
          {job.status} · {new Date(job.created_at).toLocaleString()}
        </span>
      </summary>
      <div className="mt-3 space-y-3 text-[11px]">
        <Block label="Status" value={`${job.status}${job.error ? ` — ${job.error}` : ''}`} />
        {job.phase_message && <Block label="Phase" value={job.phase_message} />}
        <details className="rounded-md border border-border/60 bg-background/40">
          <summary className="cursor-pointer px-3 py-2 font-semibold">
            enriched (Claude's raw output)
          </summary>
          <pre className="px-3 py-2 max-h-[400px] overflow-auto text-[10px] font-mono leading-relaxed">
            {JSON.stringify(job.enriched, null, 2) ?? 'null'}
          </pre>
        </details>
        <details className="rounded-md border border-border/60 bg-background/40">
          <summary className="cursor-pointer px-3 py-2 font-semibold">
            result (persistence summary — what landed in the DB)
          </summary>
          <pre className="px-3 py-2 max-h-[400px] overflow-auto text-[10px] font-mono leading-relaxed">
            {JSON.stringify(job.result, null, 2) ?? 'null'}
          </pre>
        </details>
      </div>
    </details>
  );
}

function Block({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mr-2">
        {label}
      </span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
