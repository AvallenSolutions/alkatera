'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Bell, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export interface OutreachBrandRow {
  id: string;
  name: string;
  category: string | null;
  outreach_email: string | null;
  outreach_sent_at: string | null;
  outreach_last_reminder_at: string | null;
  outreach_reminder_count: number;
  first_submission_at: string | null;
  last_submission_at: string | null;
  alkatera_tier: number;
}

interface Props {
  brands: OutreachBrandRow[];
  canSend: boolean;
}

export function OutreachTable({ brands, canSend }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(brands);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const counts = useMemo(() => {
    let notSent = 0;
    let sent = 0;
    let responded = 0;
    for (const r of rows) {
      if (r.last_submission_at) responded += 1;
      else if (r.outreach_sent_at) sent += 1;
      else notSent += 1;
    }
    return { notSent, sent, responded };
  }, [rows]);

  async function updateEmail(brandId: string, value: string) {
    setBusy(brandId);
    try {
      const res = await fetch(`/api/distributor/brands/${brandId}/outreach-email`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outreach_email: value || null }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setFeedback({ type: 'err', text: `Could not save email (${body.error ?? res.status}).` });
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === brandId ? { ...r, outreach_email: value || null } : r)));
      setFeedback({ type: 'ok', text: 'Saved.' });
    } finally {
      setBusy(null);
    }
  }

  async function send(brandIds: string[], emailType: 'initial' | 'reminder') {
    if (brandIds.length === 0) return;
    setBusy('bulk');
    try {
      const path = emailType === 'initial' ? '/api/distributor/outreach/send' : '/api/distributor/outreach/remind';
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_profile_ids: brandIds }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        sent?: number;
        skipped?: number;
        errors?: number;
        error?: string;
      };
      if (!res.ok) {
        setFeedback({ type: 'err', text: `Send failed (${body.error ?? res.status}).` });
        return;
      }
      const parts = [];
      if (body.sent) parts.push(`${body.sent} sent`);
      if (body.skipped) parts.push(`${body.skipped} skipped`);
      if (body.errors) parts.push(`${body.errors} errors`);
      setFeedback({ type: 'ok', text: parts.join(' · ') || 'Done.' });
      router.refresh();
    } catch (err: unknown) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setBusy(null);
    }
  }

  const bulkSendIds = rows.filter((r) => !r.outreach_sent_at && r.outreach_email).map((r) => r.id);
  const bulkRemindIds = rows
    .filter((r) => {
      if (!r.outreach_sent_at || r.last_submission_at) return false;
      const lastTouch = mostRecent([r.outreach_last_reminder_at, r.outreach_sent_at]);
      if (!lastTouch) return false;
      return Date.now() - new Date(lastTouch).getTime() > 14 * 24 * 60 * 60 * 1000;
    })
    .map((r) => r.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="grid grid-cols-3 gap-3 flex-1 min-w-0 sm:flex sm:gap-3">
          <Stat label="Not sent" value={counts.notSent} dot="bg-muted-foreground/50" />
          <Stat label="Awaiting" value={counts.sent} dot="bg-amber-400" />
          <Stat label="Responded" value={counts.responded} dot="bg-emerald-400" />
        </div>
        {canSend && (
          <div className="flex gap-2 flex-wrap shrink-0">
            <Button
              variant="outline"
              disabled={busy !== null || bulkSendIds.length === 0}
              onClick={() => send(bulkSendIds, 'initial')}
              className="border-sky-500/40 text-sky-200 hover:bg-sky-500/10 hover:text-sky-100"
            >
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              Send to {bulkSendIds.length} unsent
            </Button>
            <Button
              variant="outline"
              disabled={busy !== null || bulkRemindIds.length === 0}
              onClick={() => send(bulkRemindIds, 'reminder')}
              className="border-amber-500/40 text-amber-200 hover:bg-amber-500/10 hover:text-amber-100"
            >
              <Bell className="h-3.5 w-3.5 mr-1.5" />
              Remind {bulkRemindIds.length} non-responders
            </Button>
          </div>
        )}
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

      <div className="overflow-x-auto rounded-xl border border-border/60 bg-gradient-to-br from-sky-500/5 via-card/40 to-card/40">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            <tr className="border-b border-border/60 bg-background/30">
              <th className="text-left px-4 py-3.5">Brand</th>
              <th className="text-left px-4 py-3.5">Outreach email</th>
              <th className="text-left px-4 py-3.5">Status</th>
              <th className="text-left px-4 py-3.5">Last touch</th>
              <th className="text-left px-4 py-3.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const status = computeStatus(row);
              return (
                <tr
                  key={row.id}
                  className="border-b border-border/40 last:border-b-0 align-top hover:bg-sky-500/5 transition-colors"
                >
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-foreground">{row.name}</div>
                    {row.category && (
                      <div className="text-xs text-muted-foreground">{row.category}</div>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {canSend ? (
                      <EmailEditor
                        initial={row.outreach_email ?? ''}
                        onSave={(v) => updateEmail(row.id, v)}
                        disabled={busy === row.id}
                      />
                    ) : (
                      <span className="text-muted-foreground">{row.outreach_email ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">{renderStatusBadge(status)}</td>
                  <td className="px-4 py-3.5 text-xs text-muted-foreground">
                    {formatTouch(row)}
                  </td>
                  <td className="px-4 py-3.5">
                    {canSend && (
                      <div className="flex gap-2">
                        {!row.outreach_sent_at && (
                          <Button
                            size="sm"
                            disabled={!row.outreach_email || busy !== null}
                            onClick={() => send([row.id], 'initial')}
                            className="bg-sky-400 hover:bg-sky-300 text-black font-semibold"
                          >
                            Send
                          </Button>
                        )}
                        {row.outreach_sent_at && !row.last_submission_at && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!row.outreach_email || busy !== null}
                            onClick={() => send([row.id], 'reminder')}
                            className="border-amber-500/40 text-amber-200 hover:bg-amber-500/10 hover:text-amber-100"
                          >
                            Remind
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No brands yet. Upload a product list to populate the portfolio.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-gradient-to-br from-sky-500/5 via-card/40 to-card/40 px-3 py-2 flex items-center gap-2">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </span>
      <span className="font-semibold tabular-nums ml-auto text-foreground">{value}</span>
    </div>
  );
}

function EmailEditor({
  initial,
  onSave,
  disabled,
}: {
  initial: string;
  onSave: (v: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const dirty = value !== initial;
  return (
    <div className="flex gap-1.5 items-center">
      <Input
        type="email"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        placeholder="contact@brand.com"
        className="h-8 text-xs max-w-[240px]"
      />
      {dirty && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={disabled}
          onClick={() => onSave(value.trim())}
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

type Status = 'not_sent' | 'sent' | 'reminded' | 'responded' | 'stale';

function computeStatus(row: OutreachBrandRow): Status {
  if (row.last_submission_at) return 'responded';
  if (row.outreach_reminder_count > 0) return 'reminded';
  if (!row.outreach_sent_at) return 'not_sent';
  const ageMs = Date.now() - new Date(row.outreach_sent_at).getTime();
  if (ageMs > 14 * 24 * 60 * 60 * 1000) return 'stale';
  return 'sent';
}

function renderStatusBadge(status: Status) {
  const map: Record<Status, { label: string; className: string; icon?: React.ReactNode }> = {
    not_sent:  { label: 'Not sent',         className: 'text-muted-foreground border-muted' },
    sent:      { label: 'Awaiting response',className: 'text-blue-300 border-blue-500/30' },
    reminded:  { label: 'Reminder sent',    className: 'text-amber-300 border-amber-500/30' },
    stale:     { label: '14d+ no response', className: 'text-amber-400 border-amber-500/40', icon: <AlertCircle className="h-3 w-3 mr-1" /> },
    responded: { label: 'Responded',        className: 'text-emerald-300 border-emerald-500/30' },
  };
  const cfg = map[status];
  return (
    <Badge variant="outline" className={`text-xs ${cfg.className}`}>
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}

function formatTouch(row: OutreachBrandRow): string {
  const last = mostRecent([
    row.last_submission_at,
    row.outreach_last_reminder_at,
    row.outreach_sent_at,
  ]);
  if (!last) return '—';
  const date = new Date(last);
  const days = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function mostRecent(values: Array<string | null>): string | null {
  let best: string | null = null;
  for (const v of values) {
    if (!v) continue;
    if (!best || new Date(v).getTime() > new Date(best).getTime()) best = v;
  }
  return best;
}
