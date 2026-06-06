'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Check, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  brandId: string;
  initialEmail: string | null;
  uploadToken: string | null;
  uploadTokenExpiresAt: string | null;
  outreachSentAt: string | null;
  reminderCount: number;
  lastReminderAt: string | null;
  canEdit: boolean;
}

export function BrandOutreachCard({
  brandId,
  initialEmail,
  uploadToken,
  uploadTokenExpiresAt,
  outreachSentAt,
  reminderCount,
  lastReminderAt,
  canEdit,
}: Props) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail ?? '');
  const [savedEmail, setSavedEmail] = useState(initialEmail ?? '');
  const [busy, setBusy] = useState<'save' | 'send' | 'remind' | 'regen' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  // Token + expiry are kept in local state so a regenerate updates the
  // copy link and expiry display instantly (router.refresh() also re-syncs
  // from the server).
  const [token, setToken] = useState(uploadToken);
  const [expiresAt, setExpiresAt] = useState(uploadTokenExpiresAt);

  const dirty = email.trim() !== savedEmail;
  const uploadUrl = token ? `/brand-upload/${token}` : null;
  const isExpired = !!expiresAt && new Date(expiresAt).getTime() < Date.now();

  async function saveEmail() {
    if (!email && !savedEmail) return;
    setBusy('save');
    setFeedback(null);
    try {
      const res = await fetch(`/api/distributor/brands/${brandId}/outreach-email`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outreach_email: email.trim() || null }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setFeedback({ type: 'err', text: `Save failed (${body.error ?? res.status}).` });
      } else {
        setSavedEmail(email.trim());
        setFeedback({ type: 'ok', text: 'Email saved.' });
      }
    } finally {
      setBusy(null);
    }
  }

  async function send(emailType: 'initial' | 'reminder') {
    setBusy(emailType === 'initial' ? 'send' : 'remind');
    setFeedback(null);
    try {
      const path = emailType === 'initial' ? '/api/distributor/outreach/send' : '/api/distributor/outreach/remind';
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_profile_ids: [brandId] }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        sent?: number;
        skipped?: number;
        errors?: number;
        outcomes?: Array<{ status: string; reason?: string }>;
      };
      if (body.sent) {
        setFeedback({ type: 'ok', text: emailType === 'initial' ? 'Outreach email sent.' : 'Reminder email sent.' });
        router.refresh();
      } else {
        const reason = body.outcomes?.[0]?.reason ?? 'unknown';
        setFeedback({ type: 'err', text: `Email not sent (${reason}).` });
      }
    } finally {
      setBusy(null);
    }
  }

  async function copyUploadLink() {
    if (!uploadUrl) return;
    try {
      const fullUrl = `${window.location.origin}${uploadUrl}`;
      await navigator.clipboard.writeText(fullUrl);
      setFeedback({ type: 'ok', text: 'Upload link copied.' });
    } catch {
      setFeedback({ type: 'err', text: 'Could not copy to clipboard.' });
    }
  }

  async function regenerate() {
    if (isExpired === false && token) {
      const ok = window.confirm(
        'Generate a new upload link? The current link will stop working immediately.',
      );
      if (!ok) return;
    }
    setBusy('regen');
    setFeedback(null);
    try {
      const res = await fetch(`/api/distributor/brands/${brandId}/regenerate-upload-link`, {
        method: 'POST',
      });
      const body = (await res.json().catch(() => ({}))) as {
        brand?: { upload_token: string; upload_token_expires_at: string };
        error?: string;
      };
      if (!res.ok || !body.brand) {
        setFeedback({ type: 'err', text: `Could not regenerate link (${body.error ?? res.status}).` });
      } else {
        setToken(body.brand.upload_token);
        setExpiresAt(body.brand.upload_token_expires_at);
        setFeedback({ type: 'ok', text: 'New upload link generated. Copy it to share.' });
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-gradient-to-br from-sky-500/5 via-card/40 to-card/40 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="rounded-md bg-sky-500/10 border border-sky-400/30 p-1.5">
          <Mail className="h-4 w-4 text-sky-300" />
        </div>
        <span className="text-sm font-semibold">Outreach</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Outreach email
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="sustainability@brand.com"
            disabled={!canEdit || busy !== null}
          />
        </div>
        {canEdit && (
          <Button
            type="button"
            variant={dirty ? 'default' : 'outline'}
            disabled={!dirty || busy !== null}
            onClick={saveEmail}
            className={
              dirty
                ? 'bg-sky-400 hover:bg-sky-300 text-black font-semibold'
                : 'border-sky-500/40 text-sky-200 hover:bg-sky-500/10 hover:text-sky-100'
            }
          >
            {busy === 'save' ? 'Saving…' : (
              <>
                <Check className="h-3.5 w-3.5 mr-1" /> Save
              </>
            )}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <Stat label="Status" value={statusText(outreachSentAt, reminderCount, lastReminderAt)} />
        {expiresAt && (
          <Stat
            label="Upload link"
            value={
              isExpired
                ? `Expired ${new Date(expiresAt).toLocaleDateString()}`
                : `Expires ${new Date(expiresAt).toLocaleDateString()}`
            }
            tone={isExpired ? 'warn' : undefined}
          />
        )}
      </div>

      {isExpired && canEdit && (
        <div className="text-xs text-amber-300/90">
          This upload link has expired. Generate a new one to let the brand submit data again.
        </div>
      )}

      {canEdit && (
        <div className="flex flex-wrap gap-2 pt-1">
          {!outreachSentAt ? (
            <Button
              size="sm"
              disabled={!savedEmail || busy !== null}
              onClick={() => send('initial')}
              className="bg-sky-400 hover:bg-sky-300 text-black font-semibold"
            >
              {busy === 'send' ? 'Sending…' : (
                <>
                  <Mail className="h-3.5 w-3.5 mr-1.5" /> Send outreach
                </>
              )}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={!savedEmail || busy !== null}
              onClick={() => send('reminder')}
              className="border-sky-500/40 text-sky-200 hover:bg-sky-500/10 hover:text-sky-100"
            >
              {busy === 'remind' ? 'Sending…' : 'Send reminder'}
            </Button>
          )}
          {uploadUrl && !isExpired && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={copyUploadLink}
                className="border-sky-500/40 text-sky-200 hover:bg-sky-500/10 hover:text-sky-100"
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy upload link
              </Button>
              <Button
                size="sm"
                variant="ghost"
                asChild
                className="text-muted-foreground hover:text-sky-200 hover:bg-sky-500/10"
              >
                <a href={uploadUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Preview
                </a>
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant={isExpired || !token ? 'default' : 'outline'}
            disabled={busy !== null}
            onClick={regenerate}
            className={
              isExpired || !token
                ? 'bg-sky-400 hover:bg-sky-300 text-black font-semibold'
                : 'border-sky-500/40 text-sky-200 hover:bg-sky-500/10 hover:text-sky-100'
            }
          >
            {busy === 'regen' ? (
              'Generating…'
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                {token ? 'Regenerate link' : 'Generate link'}
              </>
            )}
          </Button>
        </div>
      )}

      {feedback && (
        <div
          className={`text-xs ${
            feedback.type === 'ok' ? 'text-emerald-300' : 'text-destructive'
          }`}
        >
          {feedback.text}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">
        {label}
      </div>
      <div className={`text-sm font-medium ${tone === 'warn' ? 'text-amber-300' : ''}`}>{value}</div>
    </div>
  );
}

function statusText(
  outreachSentAt: string | null,
  reminderCount: number,
  lastReminderAt: string | null,
): string {
  if (!outreachSentAt) return 'No outreach sent yet';
  const lastTouch = lastReminderAt && new Date(lastReminderAt) > new Date(outreachSentAt)
    ? lastReminderAt
    : outreachSentAt;
  const days = Math.floor((Date.now() - new Date(lastTouch).getTime()) / (24 * 60 * 60 * 1000));
  const ago = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  if (reminderCount > 0) {
    return `Reminder sent ${ago} (${reminderCount} total)`;
  }
  return `Outreach sent ${ago}`;
}
