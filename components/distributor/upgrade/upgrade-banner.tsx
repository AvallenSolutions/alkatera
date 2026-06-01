'use client';

import Link from 'next/link';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { useState } from 'react';
import { useDistributor } from '@/lib/distributor/context';

/**
 * Slim banner shown at the top of the distributor portal for free-tier
 * procurement partners (Hallgarten / Enotria while linked to Foodbuy).
 * Mentions the procurement client by name when in partner mode so the
 * user understands the trial context. Dismissable per session.
 */
export function UpgradeBanner() {
  const { organization, partnerProcurement } = useDistributor();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('alkatera_upgrade_banner_dismissed') === '1';
  });

  if (!organization.is_procurement_partner) return null;
  if (dismissed) return null;

  const partnerName = partnerProcurement
    ? partnerProcurement.display_name ?? partnerProcurement.name
    : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand-primary/30 bg-gradient-to-r from-brand-primary/12 via-brand-primary/5 to-transparent px-5 py-3.5 mb-6">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="rounded-lg bg-brand-primary/15 border border-brand-primary/30 p-1.5 shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-brand-primary" />
        </div>
        <div className="flex-1 min-w-0 text-sm">
          {partnerName ? (
            <>
              <span className="font-semibold text-foreground">
                You're part of the {partnerName} sustainability programme on alka<strong>tera</strong>.
              </span>{' '}
              <span className="text-muted-foreground">
                Procurement-routed brands are free to manage. Upload your own portfolio, Discover,
                and self-reports unlock with a full alka<strong>tera</strong> subscription.
              </span>
            </>
          ) : (
            <>
              <span className="font-semibold text-foreground">
                You're on the procurement partner tier.
              </span>{' '}
              <span className="text-muted-foreground">
                Manage your procurement-routed brands free. Upload your own SKU lists, Discover,
                and portfolio reports unlock with a full alka<strong>tera</strong> subscription.
              </span>
            </>
          )}
        </div>
        <Link
          href="mailto:hello@alkatera.com?subject=Becoming%20a%20full%20alkatera%20customer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary hover:text-brand-strong transition-colors shrink-0"
        >
          Talk to alka<strong>tera</strong>
          <ArrowRight className="h-3 w-3" />
        </Link>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem('alkatera_upgrade_banner_dismissed', '1');
            setDismissed(true);
          }}
          aria-label="Dismiss banner"
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
