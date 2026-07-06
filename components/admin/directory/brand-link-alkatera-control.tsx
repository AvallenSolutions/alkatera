'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface UnlinkedOrg {
  id: string;
  name: string;
  website: string | null;
  country: string | null;
}

interface Props {
  brandId: string;
  brandName: string;
  unlinkedOrgs: UnlinkedOrg[];
}

/**
 * Admin override for "this directory entry is actually an alka**tera**
 * customer". Used when the org-sync trigger missed the auto-link (name
 * drift, fuzzy below threshold, or the brand pre-existed the trigger).
 */
export function BrandLinkAlkateraControl({ brandId, brandName, unlinkedOrgs }: Props) {
  const router = useRouter();
  const [orgId, setOrgId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState(false);

  async function link() {
    if (!orgId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/directory/brands/${brandId}/link-alkatera`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: orgId }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        setError(body.detail ?? body.error ?? `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      setLinked(true);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Link failed');
    } finally {
      setBusy(false);
    }
  }

  if (linked) {
    return (
      <div className="rounded-[6px] border border-border bg-card p-5 flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-studio-good shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-semibold">{brandName} is now linked to an alkatera customer.</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            alka<strong>tera</strong> values overwrote the scraped data and the row was marked
            verified. Refresh if the page hasn't updated.
          </div>
        </div>
      </div>
    );
  }

  if (unlinkedOrgs.length === 0) {
    return (
      <div className="rounded-[6px] border border-border bg-card p-5 text-sm text-muted-foreground">
        No unlinked alka<strong>tera</strong> customer organisations available.
      </div>
    );
  }

  return (
    <div className="rounded-[6px] border border-border bg-card p-5 space-y-4">
      <div>
        <div className="text-sm font-semibold flex items-center gap-2">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          Mark as alka<strong>tera</strong> customer
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Use this when {brandName} is already on alka<strong>tera</strong> but the auto-link
          missed them. Linking overwrites the directory row with the customer's own data and
          marks it verified.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Select value={orgId} onValueChange={setOrgId}>
          <SelectTrigger className="bg-secondary h-9 text-sm flex-1 min-w-0">
            <SelectValue placeholder="Pick an alkatera organisation…" />
          </SelectTrigger>
          <SelectContent>
            {unlinkedOrgs.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                <span className="font-medium">{o.name}</span>
                {o.country && (
                  <span className="ml-2 text-[11px] text-muted-foreground">{o.country}</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={link}
          disabled={!orgId || busy}
          className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
        >
          {busy ? (
            'Linking…'
          ) : (
            <>
              <Link2 className="h-4 w-4 mr-1.5" /> Link &amp; verify
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="rounded-[6px] border border-border bg-secondary px-3 py-2 text-xs flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-studio-stale shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}
    </div>
  );
}
