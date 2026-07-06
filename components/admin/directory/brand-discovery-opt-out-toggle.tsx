'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  brandId: string;
  brandName: string;
  initialOptOut: boolean;
}

/**
 * Admin override for `brand_directory.discovery_opt_out`. Lets staff
 * hide a directory entry from Discover search even when the brand
 * itself hasn't flipped the toggle on the alka**tera** side. Useful
 * for moderation — e.g. a brand uploaded a placeholder name we want
 * to suppress until it's verified.
 */
export function BrandDiscoveryOptOutToggle({ brandId, brandName, initialOptOut }: Props) {
  const [optOut, setOptOut] = useState(initialOptOut);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/directory/brands/${brandId}/discovery`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discovery_opt_out: !optOut }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(`Failed (${j.error ?? res.status})`);
        return;
      }
      setOptOut(!optOut);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[6px] border border-border bg-card px-5 py-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-semibold flex items-center gap-2">
          {optOut ? (
            <EyeOff className="h-4 w-4 text-studio-attention" />
          ) : (
            <Eye className="h-4 w-4 text-studio-good" />
          )}
          Discovery visibility
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {optOut
            ? `${brandName} is hidden from the distributor Discover search. Existing distributor listings still see this brand normally.`
            : `${brandName} is discoverable to every distributor in the network.`}
        </div>
        {error && <div className="text-[11px] text-studio-stale mt-1">{error}</div>}
      </div>
      <Button
        variant={optOut ? 'default' : 'outline'}
        size="sm"
        onClick={toggle}
        disabled={busy}
      >
        {busy ? 'Working…' : optOut ? 'Make discoverable' : 'Hide from Discover'}
      </Button>
    </div>
  );
}
