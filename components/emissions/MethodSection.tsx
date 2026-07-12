'use client';

/**
 * Emissions -- WHERE THESE NUMBERS COME FROM.
 *
 * The old "How it's calculated" and "Data Quality" cards compressed to one
 * quiet section at the foot: a few lines of prose and the data-quality
 * tier bar. No icon headers, no card chrome.
 */

import Link from 'next/link';
import { Eyebrow } from '@/components/studio/eyebrow';
import { STUDIO } from '@/components/studio';

interface MethodSectionProps {
  /** Data-quality tiers in tonnes. */
  tier1: number;
  tier2: number;
  tier4: number;
}

const TIER_COLOURS = {
  tier1: STUDIO.good,
  tier2: STUDIO.cobalt,
  tier4: STUDIO.attention,
} as const;

export function MethodSection({ tier1, tier2, tier4 }: MethodSectionProps) {
  const tierTotal = tier1 + tier2 + tier4;

  return (
    <section id="method" className="space-y-4">
      <div className="border-b border-studio-hairline pb-2">
        <Eyebrow>Where these numbers come from</Eyebrow>
      </div>

      <div className="max-w-2xl space-y-2 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Scope 1 and 2</span> are calculated
          automatically from the utility data you enter at{' '}
          <Link
            href="/company/facilities"
            className="text-room-accent underline-offset-4 hover:underline"
          >
            your facilities
          </Link>
          : electricity, gas, fuels and refrigerants.
        </p>
        <p>
          <span className="font-medium text-foreground">Scope 3</span> combines your product LCAs
          (the best data you can have), the activity entries you add in the Scope 3 section, and
          spend-based estimates from Xero or CSV imports that fill the gaps while you gather
          better data.
        </p>
      </div>

      {tierTotal > 0 && (
        <div className="max-w-2xl">
          <div className="flex h-2 overflow-hidden rounded-full">
            {tier1 > 0 && (
              <div
                style={{ width: `${(tier1 / tierTotal) * 100}%`, backgroundColor: TIER_COLOURS.tier1 }}
                title={`Tier 1: ${tier1.toFixed(3)} t`}
              />
            )}
            {tier2 > 0 && (
              <div
                style={{ width: `${(tier2 / tierTotal) * 100}%`, backgroundColor: TIER_COLOURS.tier2 }}
                title={`Tier 2: ${tier2.toFixed(3)} t`}
              />
            )}
            {tier4 > 0 && (
              <div
                style={{ width: `${(tier4 / tierTotal) * 100}%`, backgroundColor: TIER_COLOURS.tier4 }}
                title={`Tier 4: ${tier4.toFixed(3)} t`}
              />
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5">
            {(
              [
                ['Tier 1 · supplier data', tier1, TIER_COLOURS.tier1],
                ['Tier 2 · activity data', tier2, TIER_COLOURS.tier2],
                ['Tier 4 · spend estimates', tier4, TIER_COLOURS.tier4],
              ] as const
            ).map(([label, value, colour]) =>
              value > 0 ? (
                <span key={label} className="flex items-center gap-1.5 text-xs text-studio-dim">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colour }} />
                  {label}
                  <span className="font-mono tabular-nums">
                    {value.toFixed(3)} t ({((value / tierTotal) * 100).toFixed(0)}%)
                  </span>
                </span>
              ) : null
            )}
          </div>
        </div>
      )}
    </section>
  );
}
