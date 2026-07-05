'use client';

/**
 * Pulse -- tier-locked widget placeholder.
 *
 * Shown in the curated tabs and Overview (the "hybrid" gating choice) when a
 * widget sits above the org's subscription tier: a quiet upsell tile that
 * names the feature and the tier that unlocks it, linking to billing. The
 * advanced grid and add-widget list hide locked widgets instead of showing
 * these.
 */

import Link from 'next/link';
import { Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { TierName } from '@/lib/subscription/feature-catalog';

const TIER_LABEL: Record<TierName, string> = {
  seed: 'Seed',
  blossom: 'Blossom',
  canopy: 'Canopy',
};

export function WidgetLockCard({ label, minTier }: { label: string; minTier: TierName }) {
  return (
    <Link href="/settings/" className="block h-full" aria-label={`${label}, upgrade to ${TIER_LABEL[minTier]}`}>
      <Card className="h-full rounded-[6px] border-dashed border-border/60 bg-muted/20 transition-colors hover:border-studio-forest/40">
        <CardContent className="flex h-full flex-col items-center justify-center gap-1.5 p-4 text-center">
          <Lock className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Upgrade to {TIER_LABEL[minTier]}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
