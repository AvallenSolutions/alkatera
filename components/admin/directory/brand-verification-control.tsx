'use client';

import { useState } from 'react';
import { Check, X, ShieldCheck, ShieldAlert, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  brandId: string;
  brandName: string;
  initialStatus: 'pending' | 'verified' | 'rejected';
}

/**
 * Admin verify/reject control for a directory brand. Verifying makes
 * the brand (and its products) discoverable; rejecting keeps it out.
 * Mirrors the review-queue actions but for a single brand on its
 * detail page.
 */
export function BrandVerificationControl({ brandId, brandName, initialStatus }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function set(next: 'verified' | 'rejected' | 'pending') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/directory/brands/${brandId}/verification`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(`Failed (${j.error ?? res.status})`);
        return;
      }
      setStatus(next);
    } finally {
      setBusy(false);
    }
  }

  const meta =
    status === 'verified'
      ? { icon: <ShieldCheck className="h-4 w-4 text-studio-good" />, text: `${brandName} is verified and discoverable to distributors.` }
      : status === 'rejected'
        ? { icon: <ShieldAlert className="h-4 w-4 text-studio-stale" />, text: `${brandName} is rejected and hidden from Discover.` }
        : { icon: <Clock className="h-4 w-4 text-studio-attention" />, text: `${brandName} is awaiting review, not yet visible in Discover.` };

  return (
    <div className="rounded-[6px] border border-border bg-card px-5 py-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-semibold flex items-center gap-2">
          {meta.icon}
          Verification
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{meta.text}</div>
        {error && <div className="text-[11px] text-studio-stale mt-1">{error}</div>}
      </div>
      <div className="flex gap-2 shrink-0">
        {status !== 'verified' && (
          <Button
            size="sm"
            onClick={() => set('verified')}
            disabled={busy}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
          >
            {!busy && <Check className="h-3.5 w-3.5 mr-1.5" />}
            Verify
          </Button>
        )}
        {status !== 'rejected' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => set('rejected')}
            disabled={busy}
            className="text-studio-stale"
          >
            <X className="h-3.5 w-3.5 mr-1.5" /> Reject
          </Button>
        )}
        {status !== 'pending' && (
          <Button size="sm" variant="outline" onClick={() => set('pending')} disabled={busy}>
            Re-queue
          </Button>
        )}
      </div>
    </div>
  );
}
