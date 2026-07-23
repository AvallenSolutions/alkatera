'use client';

import { useEffect, useState } from 'react';
import { useOrganization } from '@/lib/organizationContext';

/**
 * The provenance scoreboard: "41% of your footprint is confirmed." The desk's
 * long-term game — setup never "ends", it asymptotes. Every confirm the user
 * makes (a recipe, a real meter reading) visibly moves this number, so it
 * quietly replaces the finite onboarding checklist once the first week is over.
 * Reads the same confirmed-share rollup as /provenance.
 */
export function ProvenanceScore() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const [pct, setPct] = useState<number | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    fetch(`/api/provenance?organization_id=${orgId}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!cancelled && data && typeof data.confirmedPct === 'number') {
          setPct(Math.round(data.confirmedPct));
        }
      })
      .catch(() => { /* the line simply won't show */ });
    return () => { cancelled = true; };
  }, [orgId]);

  if (pct === null) return null;

  return (
    <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.18em] text-studio-dim">
      {pct}% of your footprint is confirmed
    </p>
  );
}
