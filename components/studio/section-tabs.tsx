'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SectionTab {
  /** Stable key, used as the selected value. */
  value: string;
  label: string;
  /** Optional mono count beside the label, e.g. a category total. */
  meta?: ReactNode;
}

/**
 * In-page tabs on the studio system: mono labels on a hairline, the current
 * one inked and underlined.
 *
 * `MonoTabs` is the room band's navigation and takes hrefs; this is its
 * state-driven sibling, for switching a view without leaving the page. Same
 * rhythm, so a user reads the two as the same control.
 *
 * Replaces the shadcn `TabsList`, which drew a filled grey pill bar — a piece
 * of chrome heavier than anything it contained.
 */
export function SectionTabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: SectionTab[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-studio-hairline',
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              '-mb-px flex items-baseline gap-1.5 border-b-2 pb-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] transition-colors duration-150 ease-studio',
              active
                ? 'border-room-accent text-foreground'
                : 'border-transparent text-studio-dim hover:text-foreground',
            )}
          >
            {tab.label}
            {tab.meta ? (
              <span className="font-mono text-[10px] font-normal tracking-[0.12em] text-studio-dim">
                {tab.meta}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
