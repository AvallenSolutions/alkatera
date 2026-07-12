'use client';

/**
 * Coachmark — a small anchored hairline callout.
 *
 * Wrap the element it explains; the callout appears just below (or above)
 * it until dismissed, persisted per user in onboarding_state.state.coachmarks.
 *
 * A primitive for future use (see tasks/onboarding-support-plan.md, Phase 2).
 * The six hand-rolled guides already in the codebase (EmissionsGuide,
 * ProductGuide, etc.) are not retrofitted onto this — new spots reach for
 * it going forward.
 */

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useOnboarding } from '@/lib/onboarding/OnboardingContext';
import { Eyebrow } from './eyebrow';

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
}

export function Coachmark({
  id,
  title,
  body,
  placement = 'below',
  children,
  className,
}: CoachmarkProps) {
  const { state, isLoading, dismissCoachmark } = useOnboarding();
  const dismissed = state.coachmarks?.[id] ?? false;

  return (
    <span className={cn('relative inline-block', className)}>
      {children}
      {!isLoading && !dismissed && (
        <span
          role="tooltip"
          className={cn(
            'absolute left-0 z-20 w-64 rounded-[6px] border border-studio-hairline bg-studio-cream p-3 text-left shadow-sm',
            placement === 'below' ? 'top-full mt-2' : 'bottom-full mb-2'
          )}
        >
          {title ? (
            <Eyebrow tone="dim" className="mb-1">
              {title}
            </Eyebrow>
          ) : null}
          <p className="text-xs leading-relaxed text-foreground">{body}</p>
          <button
            type="button"
            onClick={() => dismissCoachmark(id)}
            className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim hover:text-foreground"
          >
            Got it.
          </button>
        </span>
      )}
    </span>
  );
}
