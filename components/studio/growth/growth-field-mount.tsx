'use client';

/**
 * The one-line mount for the growth field: fetches the org's growth score
 * from /api/growth and grows the forest plus its key (the "Your forest"
 * pill), or renders nothing at all (a new visitor, a failed fetch, no org
 * yet: the surface stays plain paper, exactly as before). Mount it as a
 * SIBLING before the page's content root and give that root
 * `relative z-[1] pb-48`: field at z-0, content above, open paper at the
 * page foot for the ground layer. (Never a negative z-index: fixed layers
 * with negative z composite inconsistently while transitions run.)
 *
 * The replay: the score you last saw on this device is remembered in
 * localStorage; when you return and the org has grown, the forest opens
 * where you left it and grows the difference in front of you.
 *
 * Dev overrides (never in production): ?growth=85 forces a score,
 * ?season=winter forces the calendar.
 */

import { useEffect, useState } from 'react';
import { useOrganization } from '@/lib/organizationContext';
import type { GrowthBandKey } from '@/lib/desk/growth-score';
import { GrowthField } from './growth-field';
import { ForestKey } from './forest-key';
import type { Season } from './season';

interface GrowthPayload {
  score: number;
  bands: Record<GrowthBandKey, number> | null;
}

const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];

function storageKey(orgId: string): string {
  return `alkatera:forest:${orgId}`;
}

export function useGrowthScore(): GrowthPayload | null {
  const { currentOrganization } = useOrganization();
  const [payload, setPayload] = useState<GrowthPayload | null>(null);

  useEffect(() => {
    // The dev override wins outright, so ?growth=0 also works.
    if (process.env.NODE_ENV !== 'production') {
      const forced = new URLSearchParams(window.location.search).get('growth');
      if (forced !== null) {
        const n = Number(forced);
        if (Number.isFinite(n)) {
          setPayload({ score: Math.min(100, Math.max(0, n)), bands: null });
          return;
        }
      }
    }
    if (!currentOrganization?.id) return;
    let cancelled = false;
    fetch(`/api/growth?organization_id=${currentOrganization.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.score === 'number') {
          setPayload({ score: data.score, bands: data.bands ?? null });
        }
      })
      .catch(() => {
        // Quiet: the field simply does not grow today.
      });
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  return payload;
}

export function GrowthFieldMount({ className }: { className?: string }) {
  const { currentOrganization } = useOrganization();
  const payload = useGrowthScore();
  const orgId = currentOrganization?.id;
  // The replay start: read once per org, before the field first renders.
  const [replayFrom, setReplayFrom] = useState<number | undefined>(undefined);
  const [replayReady, setReplayReady] = useState(false);
  const [season, setSeason] = useState<Season | undefined>(undefined);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      const forced = new URLSearchParams(window.location.search).get('season');
      if (forced && (SEASONS as string[]).includes(forced)) setSeason(forced as Season);
    }
  }, []);

  useEffect(() => {
    if (!orgId) return;
    try {
      const stored = window.localStorage.getItem(storageKey(orgId));
      const n = stored === null ? undefined : Number(stored);
      setReplayFrom(n !== undefined && Number.isFinite(n) ? n : undefined);
    } catch {
      setReplayFrom(undefined);
    }
    setReplayReady(true);
  }, [orgId]);

  // Remember today's score once the replay has had its moment.
  useEffect(() => {
    if (!orgId || payload === null) return;
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey(orgId), String(payload.score));
      } catch {
        // Private browsing: the ceremony simply replays next time.
      }
    }, 3000);
    return () => window.clearTimeout(t);
  }, [orgId, payload]);

  if (payload === null || !orgId || !replayReady) return null;
  return (
    <>
      <GrowthField
        score={payload.score}
        seed={orgId}
        replayFrom={replayFrom}
        season={season}
        className={className}
      />
      <ForestKey score={payload.score} bands={payload.bands} organizationId={orgId} />
    </>
  );
}
