'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useOrganization } from '@/lib/organizationContext';
import { Eyebrow } from './eyebrow';
import { GROWTH_WEIGHTS, type GrowthBandKey, type GrowthSignal } from '@/lib/desk/growth-score';

/**
 * The first-week card: a slim checklist for the first seven days, replacing the
 * generic setup actions with a named, honest sequence. It reuses the growth
 * signals the desk already computes (each carries a real `done` flag), so items
 * auto-tick the moment the user does the thing — no fake progress. The first
 * items usually land pre-ticked because the arrival ritual genuinely did them
 * (honest endowed progress), and each open item carries its time and what it is
 * worth. Retires itself at 5/5 or after day 8, whichever comes first.
 */

interface GrowthResponse {
  score: number;
  bands: Record<GrowthBandKey, number>;
  signals?: Record<GrowthBandKey, GrowthSignal[]>;
}

interface WeekItem {
  key: string;
  label: string;
  /** true → always done (the org exists, so this genuinely happened). */
  alwaysDone?: boolean;
  band?: GrowthBandKey;
  signalId?: string;
  href?: string;
  /** time + what it's worth, shown only while the item is open. */
  meta?: string;
}

const ITEMS: WeekItem[] = [
  { key: 'company', label: 'Company found and confirmed', alwaysDone: true },
  { key: 'facility', label: 'First facility placed', band: 'foundations', signalId: 'facility', href: '/company/facilities/', meta: '2 min' },
  { key: 'product', label: 'First product on the shelf', band: 'production', signalId: 'product', href: '/products/', meta: '3 min' },
  { key: 'lca', label: 'Confirm your flagship recipe', band: 'production', signalId: 'lca', href: '/products/', meta: '4 min · tightens your number by about half' },
  { key: 'activity', label: 'Drop a utility bill on the desk', band: 'measurement', signalId: 'activity', href: '/data/scope-1-2/', meta: '1 min · replaces our grid guess' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function isDone(item: WeekItem, signals: Record<GrowthBandKey, GrowthSignal[]> | undefined): boolean {
  if (item.alwaysDone) return true;
  if (!signals || !item.band) return false;
  return signals[item.band]?.find(s => s.id === item.signalId)?.done ?? false;
}

export function FirstWeekCard() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const createdAt = currentOrganization?.created_at;
  const [growth, setGrowth] = useState<GrowthResponse | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    fetch(`/api/growth?organization_id=${orgId}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (!cancelled && data) setGrowth(data as GrowthResponse); })
      .catch(() => { /* the card simply won't show */ });
    return () => { cancelled = true; };
  }, [orgId]);

  // Retire after day 8 — the first week is over, the desk stands on its own.
  if (createdAt) {
    const ageDays = (Date.now() - new Date(createdAt).getTime()) / DAY_MS;
    if (Number.isFinite(ageDays) && ageDays > 8) return null;
  }

  if (!growth) return null;

  const rows = ITEMS.map(item => ({ item, done: isDone(item, growth.signals) }));
  const doneCount = rows.filter(r => r.done).length;

  // Retire once everything's done.
  if (doneCount >= ITEMS.length) return null;

  return (
    <section className="rounded-[6px] border border-border bg-card p-5 md:p-6">
      <Eyebrow className="mb-4 text-room-accent">Your first week · {doneCount} of {ITEMS.length} done</Eyebrow>
      <ul className="flex flex-col">
        {rows.map(({ item, done }) => {
          const inner = (
            <div className="flex items-center gap-3 py-2">
              <span
                className={
                  done
                    ? 'flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-studio-forest text-[10px] text-studio-paper'
                    : 'h-4 w-4 shrink-0 rounded-full border-[1.5px] border-studio-hairline'
                }
                aria-hidden="true"
              >
                {done ? '✓' : ''}
              </span>
              <span className={done ? 'flex-1 text-sm text-studio-dim line-through decoration-studio-hairline' : 'flex-1 text-sm text-foreground'}>
                {item.label}
              </span>
              {!done && item.meta && (
                <span className="shrink-0 whitespace-nowrap font-mono text-[10px] tracking-[0.06em] text-studio-dim">{item.meta}</span>
              )}
            </div>
          );
          return (
            <li key={item.key} className="border-b border-studio-hairline last:border-b-0">
              {!done && item.href ? (
                <Link href={item.href} className="block transition-colors hover:bg-secondary/60">{inner}</Link>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
