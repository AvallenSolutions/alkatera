'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Status {
  directoryId: string | null;
  discoveryOptOut: boolean;
  listedByCount: number;
}

/**
 * Brand-side control over a NEW axis introduced in Phase 4 of the
 * proactive-data programme: the canonical brand_directory is searchable
 * by every distributor in the alka**tera** network via the new
 * /distributor/discover/ surface. Brands that don't want their entry
 * to surface to distributors who DON'T yet list them can opt out here.
 *
 * Opting out does NOT remove the brand from distributors that already
 * list them — that's a per-distributor decision (see DistributorListPanel
 * above). It only hides the entry from the Discover search.
 */
export function DirectoryDiscoveryToggle() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    try {
      const res = await fetch('/api/brand/directory/discovery-status');
      if (!res.ok) return;
      const body = (await res.json()) as Status;
      setStatus(body);
    } catch {
      /* swallow */
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function toggle() {
    if (!status?.directoryId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/brand-directory/${status.directoryId}/discovery`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discovery_opt_out: !status.discoveryOptOut }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(`Save failed (${body.error ?? res.status}).`);
        return;
      }
      const body = (await res.json()) as { discovery_opt_out: boolean };
      setStatus({ ...status, discoveryOptOut: body.discovery_opt_out });
    } finally {
      setBusy(false);
    }
  }

  if (!status?.directoryId) {
    // Brand isn't (yet) linked to a directory entry — the daily
    // matching cron will create one shortly. Render nothing rather
    // than a control that can't work.
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {status.discoveryOptOut ? (
            <EyeOff className="h-4 w-4 text-amber-300" />
          ) : (
            <Eye className="h-4 w-4 text-emerald-300" />
          )}
          Industry directory visibility
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {status.discoveryOptOut
            ? `You are hidden from the alka`
            : `Every distributor on alka`}
          <strong>tera</strong>
          {status.discoveryOptOut
            ? `'s Discover search. Distributors who already list you (${status.listedByCount}) keep their existing access — opting back in restores you to search.`
            : `'s Discover search can find your brand and add it to their portfolio. ${status.listedByCount} distributor${status.listedByCount === 1 ? '' : 's'} already list you.`}
        </p>
        {error && <div className="text-xs text-destructive">{error}</div>}
        <div className="flex justify-end">
          <Button
            variant={status.discoveryOptOut ? 'default' : 'outline'}
            size="sm"
            disabled={busy}
            onClick={toggle}
          >
            {busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            {status.discoveryOptOut ? 'Make me discoverable' : 'Hide me from search'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
