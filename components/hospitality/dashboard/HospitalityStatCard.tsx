'use client';

/**
 * Compact stat card matching the Pulse (company vitality) visual language:
 * icon + uppercase label + optional status chip in the header, one large
 * headline, a supporting visual row, and a short footer. Self-contained (no
 * Pulse widget-registry coupling) so the hospitality overview can reuse the look.
 */

import type { ComponentType, ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export type StatTone = 'good' | 'warn' | 'bad' | 'neutral';

const TONE_CLASSES: Record<StatTone, string> = {
  good: 'text-studio-good',
  warn: 'text-studio-attention',
  bad: 'text-studio-stale',
  neutral: 'text-muted-foreground',
};

export function HospitalityStatCard({
  icon: Icon,
  label,
  headline,
  sub,
  status,
  children,
  footer,
  href,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  headline: string;
  sub?: string;
  status?: { tone: StatTone; label: string } | null;
  children?: ReactNode;
  footer?: string;
  href?: string;
}) {
  const body = (
    <div
      className={cn(
        'group relative flex h-full w-full flex-col overflow-hidden rounded-[6px] border border-border bg-card p-4 transition',
        href && 'cursor-pointer hover:-translate-y-0.5 hover:border-studio-cobalt/50',
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 flex-shrink-0 text-studio-cobalt" />
        <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        {status && (
          <span
            className={cn(
              'ml-auto font-mono text-[9px] font-bold uppercase tracking-[0.18em]',
              TONE_CLASSES[status.tone],
            )}
          >
            {status.label}
          </span>
        )}
      </div>

      <div className="mt-2 min-w-0">
        <span className="block truncate text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">{headline}</span>
        {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
      </div>

      {children !== undefined && <div className="mt-3">{children}</div>}

      {footer && <p className="mt-auto truncate pt-2 text-[10px] text-muted-foreground/80">{footer}</p>}
    </div>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
