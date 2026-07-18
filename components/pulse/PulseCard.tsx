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
import { WIDGET_REGISTRY } from '@/lib/pulse/widget-registry';
import { useWidgetCardId } from '@/components/pulse/WidgetCardContext';
import { PulseExplainer } from '@/components/pulse/PulseExplainer';

export type PulseCardFootprint = '1x1' | '2x1' | '2x2';

export type PulseCardStatusTone = 'good' | 'warn' | 'bad' | 'neutral';

export interface PulseCardStatus {
  tone: PulseCardStatusTone;
  label: string;
}

export interface PulseCardProps {
  /** Accepted for call-site compatibility but no longer rendered — the
   * studio has no general icon set; the mono label carries the meaning
   * (design/studio-design-language.md). Widgets can drop the prop at
   * leisure. */
  icon?: ComponentType<{ className?: string }>;
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

/** Tailwind classes for each status tone. Typographic state chips: no pills. */
const STATUS_CLASSES: Record<PulseCardStatusTone, string> = {
  good: 'text-studio-good',
  warn: 'text-studio-attention',
  bad: 'text-studio-stale',
  neutral: 'text-studio-dim',
};

/**
 * Height (px) for the supporting-visual row, by footprint.
 * `min-h-0` on 2x1 lets the visual shrink when a footer line needs the room,
 * so the footer is never clipped by the card's overflow-hidden shell; it still
 * keeps the full 120px whenever there is space.
 */
const VISUAL_HEIGHT: Record<PulseCardFootprint, string> = {
  '1x1': 'h-16',
  '2x1': 'h-[120px] min-h-0',
  '2x2': 'flex-1 min-h-[120px]',
};

export function PulseCard({
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
  const widgetId = useWidgetCardId();
  const explainer = widgetId ? WIDGET_REGISTRY[widgetId]?.explainer : undefined;

  return (
    <div
      className={cn(
        'group relative flex h-full w-full flex-col overflow-hidden rounded-[6px] border transition-colors duration-150 ease-studio',
        error
          ? 'border-studio-stale/40 bg-card'
          : 'border-border bg-card',
        onExpand && !error
          ? 'cursor-pointer hover:border-studio-forest/50 focus-within:border-studio-forest'
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
          className="absolute inset-0 z-0 rounded-[6px] focus:outline-none focus-visible:ring-2 focus-visible:ring-studio-forest"
        />
      )}

      <div className="pointer-events-none relative z-10 flex h-full flex-col p-4">
        {/* Header row: a mono eyebrow, no glyph — type carries the meaning. */}
        <div className="pointer-events-auto flex items-center gap-2">
          <span className="truncate font-mono text-[9.5px] font-bold uppercase tracking-[0.2em] text-studio-dim">
            {label}
          </span>

          <div className="ml-auto flex items-center gap-1.5">
            {status && (
              <span
                className={cn(
                  'font-mono text-[9px] font-bold uppercase tracking-[0.18em]',
                  STATUS_CLASSES[status.tone],
                )}
              >
                {status.label}
              </span>
            )}
            {explainer && <PulseExplainer label={label} explainer={explainer} />}
            {onTogglePin && (
              <button
                type="button"
                onClick={onTogglePin}
                aria-label={pinned ? 'Unpin card' : 'Pin card to top'}
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition',
                  pinned
                    ? 'text-studio-forest opacity-100'
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
            <div className="h-8 w-3/4 rounded bg-muted/60" />
          ) : (
            <div className="flex items-baseline gap-2">
              {/* The number is the subject: display voice, bold, tabular —
                  same scale as BigNumber's panel size. */}
              <span className="truncate font-display text-[1.75rem] font-bold leading-none tabular-nums text-foreground">
                {headline}
              </span>
            </div>
          )}
          {error ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-studio-stale">
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
