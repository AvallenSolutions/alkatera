'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StateChip } from './state-chip';
import type { WorkingTone } from './theme';

export interface FactRowItem {
  id: string;
  /** Bold subject, display face. */
  title: ReactNode;
  /** Quiet one-line detail beneath the subject. */
  hint?: ReactNode;
  /** Typographic state beside the subject (working tones, never decoration). */
  chip?: { tone: WorkingTone; label: string };
  /** A figure standing right: display-bold, tabular, mono unit beneath its side. */
  value?: string;
  unit?: string | null;
  /** Mono meta on the right when there is no figure (a time, an age). */
  meta?: ReactNode;
  /** A small leading visual (e.g. a product thumbnail). Keep it quiet. */
  leading?: ReactNode;
  /** A small trailing control (e.g. a snooze ×). Stops propagation itself. */
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  /** Fires alongside an href navigation (e.g. analytics). */
  onNavigate?: () => void;
}

/**
 * The fact list: the studio's quiet row rhythm for things that need you.
 * Bold subject with an optional working-tone chip, a plain sentence
 * beneath, a figure or mono meta standing right, hairlines between rows.
 * Rows that link grow an arrow on approach.
 *
 * For a plain one-line fact in the margins (subject · detail, mono time)
 * reach for FactRow instead; reach for either before inventing a card.
 */
export function FactList({
  items,
  className,
  dense = false,
}: {
  items: FactRowItem[];
  className?: string;
  /** Tighter rows for the margins of a page. */
  dense?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <ul className={cn('divide-y divide-border', className)}>
      {items.map((item) => {
        const row = (
          <div className={cn('flex items-center gap-4', dense ? 'py-2' : 'py-3')}>
            {item.leading ? <div className="shrink-0">{item.leading}</div> : null}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-3">
                <span className="truncate font-display text-sm font-semibold text-foreground">
                  {item.title}
                </span>
                {item.chip ? (
                  <StateChip tone={item.chip.tone}>{item.chip.label}</StateChip>
                ) : null}
              </div>
              {item.hint ? (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.hint}</p>
              ) : null}
            </div>
            {item.value ? (
              <span className="shrink-0 font-display text-lg font-bold tabular-nums text-foreground">
                {item.value}
                {item.unit ? (
                  <span className="ml-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    {item.unit}
                  </span>
                ) : null}
              </span>
            ) : null}
            {item.meta ? (
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {item.meta}
              </span>
            ) : null}
            {item.trailing}
            {item.href || item.onClick ? (
              <ArrowRight
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-studio group-hover:translate-x-0.5 group-hover:text-room-accent"
                aria-hidden="true"
              />
            ) : null}
          </div>
        );
        return (
          <li key={item.id}>
            {item.href ? (
              <Link href={item.href} onClick={item.onNavigate} className="group block">
                {row}
              </Link>
            ) : item.onClick ? (
              <button type="button" onClick={item.onClick} className="group block w-full text-left">
                {row}
              </button>
            ) : (
              row
            )}
          </li>
        );
      })}
    </ul>
  );
}
