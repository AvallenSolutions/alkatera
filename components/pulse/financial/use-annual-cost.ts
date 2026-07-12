'use client';

import { useEffect, useState } from 'react';
import { useOrganization } from '@/lib/organizationContext';

/** "£46.2k" above 100k, otherwise full pounds ("£8,400", pence under £100). */
export function formatGbp(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 100_000) {
    return v.toLocaleString('en-GB', {
      style: 'currency',
      currency: 'GBP',
      notation: 'compact',
      maximumFractionDigits: 1,
    });
  }
  return v.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: abs >= 100 ? 0 : 2,
  });
}

export interface AnnualEnvironmentalCost {
  /** Raw trailing 12-month total; null until loaded. */
  totalGbp: number | null;
  /** The display figure; null until loaded. */
  figure: string | null;
}

/**
 * The annual environmental cost: the trailing 12-month total the Financial
 * statement leads with, shared with the Brief's day's-numbers row. Null
 * until loaded; callers stand without the figure if the API is quiet.
 */
export function useAnnualEnvironmentalCost(): AnnualEnvironmentalCost {
  const { currentOrganization } = useOrganization();
  const [totalGbp, setTotalGbp] = useState<number | null>(null);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    let cancelled = false;
    fetch(`/api/pulse/financial-footprint?organization_id=${currentOrganization.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const total = data?.trailing_12_months?.total_gbp;
        if (!cancelled && typeof total === 'number') setTotalGbp(total);
      })
      .catch(() => {
        // Quiet: the caller carries its surface without the figure.
      });
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  return { totalGbp, figure: totalGbp === null ? null : formatGbp(totalGbp) };
}
