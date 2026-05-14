'use client';

import { useEffect, useState } from 'react';
import {
  Building2,
  ShieldCheck,
  ShieldOff,
  Loader2,
  SlidersHorizontal,
  Trash2,
  Undo2,
  Package,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FieldSharingControls } from './field-sharing-controls';
import type {
  BrandDistributorListing,
  SharingState,
} from '@/app/api/brand/distributors/listings/route';

const SHARING_BADGE: Record<SharingState, { label: string; className: string; icon: JSX.Element }> = {
  shared: {
    label: 'Sharing all data',
    className: 'text-emerald-300 border-emerald-500/30',
    icon: <ShieldCheck className="h-3 w-3 mr-1" />,
  },
  blocked: {
    label: 'Blocked',
    className: 'text-destructive border-destructive/30',
    icon: <ShieldOff className="h-3 w-3 mr-1" />,
  },
  custom: {
    label: 'Custom (per-field)',
    className: 'text-amber-300 border-amber-500/30',
    icon: <SlidersHorizontal className="h-3 w-3 mr-1" />,
  },
};

/**
 * Brand-side panel listing every distributor that lists this brand
 * (Phase 5). Unlike the previous version which only showed
 * confirmed-link distributors, this view is the canonical "who's
 * looking at me" surface. Each row offers:
 *
 *   - a blanket "Block this distributor" toggle (writes
 *     brand_sharing_preferences with block_all_fields=true)
 *   - expandable per-field controls (reuse FieldSharingControls)
 *   - "Remove from this portfolio" (sets listing_status='delisted'
 *     for this distributor's listing only)
 */
export function DistributorListPanel() {
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<BrandDistributorListing[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/brand/distributors/listings');
      if (!res.ok) {
        setFeedback({ type: 'err', text: 'Could not load distributors.' });
        return;
      }
      const body = (await res.json()) as { listings: BrandDistributorListing[] };
      setListings(body.listings ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function setVisibility(distributorOrgId: string, blocked: boolean) {
    setBusy(distributorOrgId);
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/brand/distributors/listings/${distributorOrgId}/visibility`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blocked }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setFeedback({ type: 'err', text: `Save failed (${body.error ?? res.status}).` });
        return;
      }
      await load();
      setFeedback({
        type: 'ok',
        text: blocked ? 'Distributor blocked.' : 'Sharing restored.',
      });
    } finally {
      setBusy(null);
    }
  }

  async function setDelisted(distributorOrgId: string, delisted: boolean) {
    if (delisted) {
      const ok = confirm(
        'Remove yourself from this distributor\'s portfolio? They will no longer see your brand in their default brand list. Your sustainability data stays in the directory.',
      );
      if (!ok) return;
    }
    setBusy(distributorOrgId);
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/brand/distributors/listings/${distributorOrgId}/delist`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ delisted }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setFeedback({ type: 'err', text: `Save failed (${body.error ?? res.status}).` });
        return;
      }
      await load();
      setFeedback({
        type: 'ok',
        text: delisted ? 'Listing removed.' : 'Listing restored.',
      });
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          className={`text-xs px-3 py-2 rounded border ${
            feedback.type === 'ok'
              ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/5'
              : 'border-destructive/30 text-destructive bg-destructive/5'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {listings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No distributors list your brand on alka<strong>tera</strong> yet. If a distributor adds
            your brand to their portfolio, they will appear here.
          </CardContent>
        </Card>
      ) : (
        listings.map((listing) => {
          const isDelisted = listing.listing_status === 'delisted';
          const badge = SHARING_BADGE[listing.sharing_state];
          const isBlocked = listing.sharing_state === 'blocked';
          return (
            <Card
              key={listing.distributor_org_id}
              className={isDelisted ? 'opacity-60' : ''}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-teal-500" />
                    {listing.distributor_name}
                  </CardTitle>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span>Listed {new Date(listing.listing_created_at).toLocaleDateString()}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {listing.sku_count} SKU{listing.sku_count === 1 ? '' : 's'}
                    </span>
                    {listing.link?.confirmed_by_brand && (
                      <>
                        <span>·</span>
                        <span className="text-emerald-300/80">Connected via alka<strong>tera</strong></span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {isDelisted ? (
                    <Badge variant="outline" className="text-xs text-muted-foreground border-muted">
                      Removed from portfolio
                    </Badge>
                  ) : (
                    <Badge variant="outline" className={`text-xs ${badge.className}`}>
                      {badge.icon}
                      {badge.label}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {!isDelisted && (
                    <>
                      <Button
                        size="sm"
                        variant={isBlocked ? 'default' : 'outline'}
                        disabled={busy === listing.distributor_org_id}
                        onClick={() =>
                          setVisibility(listing.distributor_org_id, !isBlocked)
                        }
                        className={
                          isBlocked
                            ? 'bg-teal-500 hover:bg-teal-400 text-black'
                            : ''
                        }
                      >
                        {isBlocked ? 'Unblock sharing' : 'Block this distributor'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setExpanded((cur) =>
                            cur === listing.distributor_org_id
                              ? null
                              : listing.distributor_org_id,
                          )
                        }
                      >
                        {expanded === listing.distributor_org_id
                          ? 'Hide field controls'
                          : 'Field-level controls'}
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy === listing.distributor_org_id}
                    onClick={() => setDelisted(listing.distributor_org_id, !isDelisted)}
                    className={
                      isDelisted
                        ? 'text-muted-foreground hover:text-foreground'
                        : 'text-muted-foreground hover:text-destructive'
                    }
                  >
                    {isDelisted ? (
                      <>
                        <Undo2 className="h-3.5 w-3.5 mr-1.5" /> Undo removal
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remove from this portfolio
                      </>
                    )}
                  </Button>
                </div>

                {expanded === listing.distributor_org_id && !isDelisted && (
                  <div className="pt-3 border-t border-border">
                    <FieldSharingControls
                      distributorOrgId={listing.distributor_org_id}
                      distributorName={listing.distributor_name}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
