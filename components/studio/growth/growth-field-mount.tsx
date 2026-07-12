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
import { GROWTH_WEIGHTS, type GrowthBandKey } from '@/lib/desk/growth-score';
import { GrowthField, rosaSpotForSession } from './growth-field';
import { ForestKey } from './forest-key';
import { BandCompletionToast } from './band-completion-toast';
import { hemisphereForCountry, seasonForDate, type Season } from './season';

interface GrowthPayload {
  score: number;
  bands: Record<GrowthBandKey, number> | null;
}

const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];

function storageKey(orgId: string): string {
  return `alkatera:forest:${orgId}`;
}

function bandsStorageKey(orgId: string): string {
  return `alkatera:bands:${orgId}`;
}

/**
 * The band-completion moment: compares this visit's per-band completion
 * against the last-seen snapshot in localStorage, and reports at most one
 * newly-completed band (never more than one moment per page load). A band
 * counts as complete once its points reach its full weight (see
 * GROWTH_WEIGHTS). Silent on the very first visit — there is nothing to
 * compare against yet, so nothing "newly" completed.
 */
function useBandCompletion(
  orgId: string | undefined,
  bands: Record<GrowthBandKey, number> | null,
): [GrowthBandKey | null, () => void] {
  const [band, setBand] = useState<GrowthBandKey | null>(null);
  const [evaluatedFor, setEvaluatedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId || !bands || evaluatedFor === orgId) return;
    setEvaluatedFor(orgId);
    try {
      const key = bandsStorageKey(orgId);
      const raw = window.localStorage.getItem(key);
      const prevDone: Partial<Record<GrowthBandKey, boolean>> = raw ? JSON.parse(raw) : {};
      const nextDone: Partial<Record<GrowthBandKey, boolean>> = {};
      let newlyCompleted: GrowthBandKey | null = null;
      for (const bandKey of Object.keys(GROWTH_WEIGHTS) as GrowthBandKey[]) {
        const done = bands[bandKey] >= GROWTH_WEIGHTS[bandKey] - 0.01;
        nextDone[bandKey] = done;
        // Only a real snapshot (raw !== null) can make a completion "new" —
        // a first-ever visit simply records the baseline, quietly.
        if (raw !== null && done && !prevDone[bandKey] && !newlyCompleted) {
          newlyCompleted = bandKey;
        }
      }
      window.localStorage.setItem(key, JSON.stringify(nextDone));
      if (newlyCompleted) setBand(newlyCompleted);
    } catch {
      // Private browsing: the moment simply doesn't fire today.
    }
  }, [orgId, bands, evaluatedFor]);

  return [band, () => setBand(null)];
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
  const [completedBand, clearCompletedBand] = useBandCompletion(orgId, payload?.bands ?? null);

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

  // One view state, shared by the field and the key: what the user sees
  // is exactly what "Download your forest" hands back.
  const effectiveSeason =
    season ?? seasonForDate(new Date(), hemisphereForCountry(currentOrganization?.country));
  const rosaSpot = rosaSpotForSession(orgId);

  return (
    <>
      <GrowthField
        score={payload.score}
        seed={orgId}
        replayFrom={replayFrom}
        season={effectiveSeason}
        className={className}
      />
      <ForestKey
        score={payload.score}
        bands={payload.bands}
        organizationId={orgId}
        season={effectiveSeason}
        rosaSpot={rosaSpot}
      />
      {completedBand && (
        <BandCompletionToast band={completedBand} onDone={clearCompletedBand} />
      )}
    </>
  );
}
