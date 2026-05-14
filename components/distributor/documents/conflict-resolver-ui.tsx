'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, X, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FIELD_DEFINITIONS } from '@/lib/distributor/scraping/field-definitions';

export interface ConflictRow {
  id: string;
  brand_directory_id: string;
  brand_name?: string | null;
  field_key: string;
  existing_value: string | null;
  existing_source: string | null;
  existing_confidence: number | null;
  new_value: string | null;
  new_source: string;
  new_confidence: number | null;
  submission_id: string | null;
  created_at: string;
}

interface Props {
  conflicts: ConflictRow[];
  canResolve: boolean;
}

const FIELD_LABEL = new Map<string, string>(FIELD_DEFINITIONS.map((f) => [f.key, f.label]));

export function ConflictResolverUI({ conflicts, canResolve }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(conflicts);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function resolve(id: string, resolution: 'keep_existing' | 'use_new') {
    setBusy(id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/distributor/documents/conflicts/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setFeedback({ type: 'err', text: `Could not save (${body.error ?? res.status}).` });
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      setFeedback({ type: 'ok', text: resolution === 'use_new' ? 'Switched to brand-uploaded value.' : 'Kept existing value.' });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 py-12 flex flex-col items-center gap-3 text-sm">
        <div className="rounded-lg bg-emerald-500/15 border border-emerald-400/30 p-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-300" />
        </div>
        <p className="text-foreground font-medium">All conflicts resolved.</p>
        <p className="text-muted-foreground">Nothing else needs your decision right now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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

      {rows.map((row) => {
        const label = FIELD_LABEL.get(row.field_key) ?? row.field_key;
        return (
          <div
            key={row.id}
            className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-card/40 to-card/40 p-5"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-amber-500/15 border border-amber-400/30 p-1.5 shrink-0">
                <AlertTriangle className="h-4 w-4 text-amber-300" />
              </div>
              <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-sm font-semibold">{label}</div>
                    {row.brand_name && (
                      <div className="text-xs text-muted-foreground">{row.brand_name}</div>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Reported {new Date(row.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ValuePanel
                    title="Existing"
                    value={row.existing_value}
                    source={row.existing_source}
                    confidence={row.existing_confidence}
                  />
                  <ValuePanel
                    title="Brand uploaded"
                    value={row.new_value}
                    source={row.new_source}
                    confidence={row.new_confidence}
                    highlight
                  />
                </div>

                {canResolve && (
                  <div className="flex gap-2 pt-1 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === row.id}
                      onClick={() => resolve(row.id, 'keep_existing')}
                      className="border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent"
                    >
                      <X className="h-3.5 w-3.5 mr-1.5" /> Keep existing
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy === row.id}
                      onClick={() => resolve(row.id, 'use_new')}
                      className="bg-sky-400 hover:bg-sky-300 text-black font-semibold"
                    >
                      <Check className="h-3.5 w-3.5 mr-1.5" /> Use uploaded value
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ValuePanel({
  title,
  value,
  source,
  confidence,
  highlight,
}: {
  title: string;
  value: string | null;
  source: string | null;
  confidence: number | null;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3.5 ${
        highlight
          ? 'border-sky-400/40 bg-sky-500/10'
          : 'border-border/60 bg-background/40'
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
        {title}
      </div>
      <div className="text-sm font-semibold break-words tabular-nums">{value ?? '—'}</div>
      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        {source && (
          <Badge
            variant="outline"
            className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground"
          >
            {source}
          </Badge>
        )}
        {confidence != null && (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {Math.round(confidence * 100)}% confidence
          </span>
        )}
      </div>
    </div>
  );
}
