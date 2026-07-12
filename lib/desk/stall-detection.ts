/**
 * The stalled-band nudge: has this org's forest score sat still for a
 * fortnight? Client-only, no server round-trip — a small companion to the
 * growth-field replay in components/studio/growth/growth-field-mount.tsx,
 * which snapshots the same idea (score over time) for a different purpose
 * (the replay animation) using a sibling localStorage key.
 *
 * The rule: remember the score and the moment it was last seen to change.
 * If the score you see today matches what's remembered, and that memory is
 * 14 days old or more, the forest has been quiet for a while. If the score
 * has moved, or there's no memory yet, reset the clock and stay silent.
 *
 * See tasks/onboarding-support-plan.md, Phase 4.
 */

const STALL_DAYS = 14;

interface ScoreSnapshot {
  score: number;
  since: string;
}

function stallStorageKey(orgId: string): string {
  return `alkatera:score-snapshot:${orgId}`;
}

/**
 * Reads and (when the score has moved) updates the org's score snapshot,
 * returning whether the score has been stuck for STALL_DAYS or more.
 * Never throws; a private-browsing tab or a stale/corrupt value simply
 * yields no nudge.
 */
export function checkScoreStall(orgId: string, score: number): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const key = stallStorageKey(orgId);
    const raw = window.localStorage.getItem(key);
    const now = Date.now();

    if (!raw) {
      window.localStorage.setItem(key, JSON.stringify({ score, since: new Date(now).toISOString() }));
      return false;
    }

    const snapshot = JSON.parse(raw) as Partial<ScoreSnapshot>;
    if (typeof snapshot.score !== 'number' || typeof snapshot.since !== 'string') {
      window.localStorage.setItem(key, JSON.stringify({ score, since: new Date(now).toISOString() }));
      return false;
    }

    if (snapshot.score !== score) {
      // The forest moved — reset the clock, no nudge today.
      window.localStorage.setItem(key, JSON.stringify({ score, since: new Date(now).toISOString() }));
      return false;
    }

    const sinceMs = new Date(snapshot.since).getTime();
    if (!Number.isFinite(sinceMs)) return false;
    const daysStill = (now - sinceMs) / (24 * 60 * 60 * 1000);
    return daysStill >= STALL_DAYS;
  } catch {
    return false;
  }
}
