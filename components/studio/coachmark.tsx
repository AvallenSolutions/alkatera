'use client';

/**
 * Coachmark — a small anchored hairline callout.
 *
 * Wrap the element it explains; the callout appears just below (or above)
 * it until dismissed, persisted per user in onboarding_state.state.coachmarks.
 *
 * A primitive for future use (see tasks/onboarding-support-plan.md, Phase 2).
 * The legacy hand-rolled guides in the codebase (EmissionsGuide, ProductGuide,
 * etc.) converge onto its visual shell (`CoachmarkBody`) where their own
 * positioning needs (portals anchored to an arbitrary DOM node elsewhere on
 * the page, e.g. FactorInfoHint) don't fit the wrap-your-children model here.
 */

import { forwardRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useOnboarding } from '@/lib/onboarding/OnboardingContext';
import { Eyebrow } from './eyebrow';

interface CoachmarkBodyProps {
  /** Optional mono eyebrow above the body. */
  title?: string;
  /** One or two plain sentences. British English, no em dashes, full stops. */
  body: string;
  /** Fired when the dismiss control is pressed. */
  onDismiss: () => void;
  /** Quiet dismiss label — "Got it." by default. */
  dismissLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Defaults to 'tooltip'; pass 'dialog' for a portal-anchored hint with its own aria-label. */
  role?: 'tooltip' | 'dialog';
  ariaLabel?: string;
  /**
   * Replaces the single dismiss control. A sequence needs Back, Skip and Next
   * in the same mono register; everything else keeps the one quiet dismiss.
   */
  footer?: ReactNode;
}

/**
 * The visual shell alone: cream, hairline border, mono eyebrow, quiet
 * dismiss. No positioning of its own — the caller wraps it in whatever
 * placement (inline `absolute`, or a portal anchored to a rect elsewhere
 * in the DOM) its situation needs.
 */
export const CoachmarkBody = forwardRef<HTMLDivElement, CoachmarkBodyProps>(function CoachmarkBody(
  {
    title,
    body,
    onDismiss,
    dismissLabel = 'Got it.',
    className,
    style,
    role = 'tooltip',
    ariaLabel,
    footer,
  },
  ref,
) {
  return (
    <div
      ref={ref}
      role={role}
      aria-label={ariaLabel}
      style={style}
      className={cn(
        'w-64 rounded-[6px] border border-studio-hairline bg-studio-cream p-3 text-left shadow-sm',
        className
      )}
    >
      {title ? (
        <Eyebrow tone="dim" className="mb-1">
          {title}
        </Eyebrow>
      ) : null}
      <p className="text-xs leading-relaxed text-foreground">{body}</p>
      {footer ?? (
        <button
          type="button"
          onClick={onDismiss}
          className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim hover:text-foreground"
        >
          {dismissLabel}
        </button>
      )}
    </div>
  );
});

interface CoachmarkProps {
  /** Unique id — the key under state.coachmarks that remembers the dismissal. */
  id: string;
  /** Optional mono eyebrow above the body. */
  title?: string;
  /** One or two plain sentences. British English, no em dashes, full stops. */
  body: string;
  /** Which side of the wrapped element the callout opens on. */
  placement?: 'below' | 'above';
  /** The element the coachmark is anchored to. */
  children: ReactNode;
  className?: string;
  /**
   * Controlled mode: when both `open` and `onDismiss` are supplied, the
   * coachmark's visibility and dismissal are driven by the caller instead
   * of the id-based onboarding_state persistence. Additive — omit both to
   * keep the default self-persisting behaviour.
   */
  open?: boolean;
  onDismiss?: () => void;
}

export function Coachmark({
  id,
  title,
  body,
  placement = 'below',
  children,
  className,
  open,
  onDismiss,
}: CoachmarkProps) {
  const { state, isLoading, dismissCoachmark } = useOnboarding();
  const isControlled = open !== undefined && onDismiss !== undefined;
  const dismissed = isControlled ? !open : (state.coachmarks?.[id] ?? false);
  const loading = isControlled ? false : isLoading;
  const handleDismiss = isControlled ? onDismiss! : () => dismissCoachmark(id);

  return (
    <span className={cn('relative inline-block', className)}>
      {children}
      {!loading && !dismissed && (
        <CoachmarkBody
          title={title}
          body={body}
          onDismiss={handleDismiss}
          className={cn('absolute left-0 z-20', placement === 'below' ? 'top-full mt-2' : 'bottom-full mb-2')}
        />
      )}
    </span>
  );
}
