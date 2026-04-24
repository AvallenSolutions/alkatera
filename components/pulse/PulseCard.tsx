'use client';

/**
 * Pulse -- Shared compact card wrapper.
 *
 * Every widget renders its compact body through this component. Keeps the
 * dashboard visually uniform: icon + label + status chip in the header, one
 * large headline number + unit, one supporting visual row, an optional short
 * footer line. The whole card body is a single button that opens the drill-in
 * overlay.
 *
 * Size is controlled by the widget-registry footprint ('1x1' | '2x1' | '2x2'),
 * which PulseGrid translates into layout coordinates. This component only
 * needs the footprint to pick the right visual-row height.
 */

import type { ComponentType, ReactNode } from 'react';
import { Maximize2, Pin, PinOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PulseCardFootprint = '1x1' | '2x1' | '2x2';

export type PulseCardStatusTone = 'good' | 'warn' | 'bad' | 'neutral';

export interface PulseCardStatus {
  tone: PulseCardStatusTone;
  label: string;
}

export interface PulseCardProps {
  /** Lucide icon for the header. */
  icon: ComponentType<{ className?: string }>;
  /** Short label, uppercase tracking in the header (e.g. "Annual liability"). */
  label: string;
  /** Headline figure, rendered large (e.g. "£1.24M"). */
  headline: string;
  /** Optional unit / sub-line under the headline (e.g. "trailing 12 months"). */
  sub?: string;
  /** Optional status chip right-aligned in the header. */
  status?: PulseCardStatus | null;
  /** Supporting visual (sparkline / mini-bars / pips). */
  children?: ReactNode;
  /** Optional short context line at the bottom, ~50 chars. */
  footer?: string;
  /** Card footprint. Drives the visual row height; layout placement is PulseGrid's job. */
  footprint?: PulseCardFootprint;
  /** Fired when the user clicks the card body (opens drill). */
  onExpand?: () => void;
  /** Whether the card is pinned. When true, the pin icon renders solid. */
  pinned?: boolean;
  /** Fired when the pin toggle is clicked. Omit to hide the pin button. */
  onTogglePin?: () => void;
  /** Loading state: show skeleton in the headline row. */
  loading?: boolean;
  /** Error state: when set, card shows a subtle red ring + error in the sub line. */
  error?: string | null;
  /** Override class on the outer shell. */
  className?: string;
}

/** Tailwind classes for each status tone. */
const STATUS_CLASSES: Record<PulseCardStatusTone, string> = {
  good: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
  warn: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  bad: 'bg-red-500/10 text-red-500 border-red-500/30',
  neutral: 'bg-muted text-muted-foreground border-border/60',
};

/** Height (px) for the supporting-visual row, by footprint. */
const VISUAL_HEIGHT: Record<PulseCardFootprint, string> = {
  '1x1': 'h-16',
  '2x1': 'h-[120px]',
  '2x2': 'flex-1 min-h-[120px]',
};

export function PulseCard({
  icon: Icon,
  label,
  headline,
  sub,
  status,
  children,
  footer,
  footprint = '1x1',
  onExpand,
  pinned,
  onTogglePin,
  loading,
  error,
  className,
}: PulseCardProps) {
  return (
    <div
      className={cn(
        'group relative flex h-full w-full flex-col overflow-hidden rounded-xl border transition',
        error
          ? 'border-red-500/40 bg-red-500/5'
          : 'border-border/60 bg-card/40',
        onExpand && !error
          ? 'cursor-pointer hover:border-[#ccff00]/50 hover:bg-card/60 focus-within:border-[#ccff00]'
          : '',
        className,
      )}
    >
      {/* Whole-card click surface. Kept as a sibling so the pin button isn't
          nested inside it (avoids nested <button> and swallows stop-propagation
          without tricks). */}
      {onExpand && (
        <button
          type="button"
          onClick={onExpand}
          aria-label={`Open ${label} details`}
          className="absolute inset-0 z-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ccff00]"
        />
      )}

      <div className="pointer-events-none relative z-10 flex h-full flex-col p-4">
        {/* Header row */}
        <div className="pointer-events-auto flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 flex-shrink-0 text-[#ccff00]" />
          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>

          <div className="ml-auto flex items-center gap-1.5">
            {status && (
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider',
                  STATUS_CLASSES[status.tone],
                )}
              >
                {status.label}
              </span>
            )}
            {onTogglePin && (
              <button
                type="button"
                onClick={onTogglePin}
                aria-label={pinned ? 'Unpin card' : 'Pin card to top'}
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition',
                  pinned
                    ? 'text-[#ccff00] opacity-100'
                    : 'opacity-0 hover:text-foreground group-hover:opacity-70 group-focus-within:opacity-70',
                )}
              >
                {pinned ? (
                  <Pin className="h-3 w-3 fill-current" />
                ) : (
                  <PinOff className="h-3 w-3" />
                )}
              </button>
            )}
            {onExpand && (
              <Maximize2
                className="h-3 w-3 text-muted-foreground opacity-0 transition group-hover:opacity-60 group-focus-within:opacity-60"
                aria-hidden="true"
              />
            )}
          </div>
        </div>

        {/* Headline metric */}
        <div className="pointer-events-none mt-2 min-w-0">
          {loading ? (
            <div className="h-8 w-3/4 animate-pulse rounded bg-muted/60" />
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="truncate text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">
                {headline}
              </span>
            </div>
          )}
          {error ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-red-500">
              {error}
            </p>
          ) : (
            sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>
          )}
        </div>

        {/* Supporting visual row */}
        {children !== undefined && (
          <div className={cn('pointer-events-none mt-3', VISUAL_HEIGHT[footprint])}>
            {children}
          </div>
        )}

        {/* Footer line */}
        {footer && (
          <p className="pointer-events-none mt-auto truncate pt-2 text-[10px] text-muted-foreground/80">
            {footer}
          </p>
        )}
      </div>
    </div>
  );
}
