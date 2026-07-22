'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { FieldLabel } from './field-label';

interface InheritedFieldProps {
  /** The field's mono label. */
  label: ReactNode;
  /**
   * Where the value comes from when nobody has overridden it, phrased as a
   * short sentence fragment: "your EPR settings", "the Islay warehouse",
   * "your climate zone". Rendered after "From" or "Derived from".
   */
  source: ReactNode;
  /** The inherited value, shown as plain text while the field is inheriting. */
  inheritedValue: ReactNode;
  /** True when this row carries its own value instead of the inherited one. */
  overridden: boolean;
  /** Switch to the row's own value. The control appears and should take focus. */
  onOverride: () => void;
  /** Drop the row's own value and go back to inheriting. */
  onRevert: () => void;
  /**
   * States the value was computed rather than inherited from a level above,
   * so the copy reads "Derived from your climate zone" instead of "From".
   */
  derived?: boolean;
  /** The control, rendered only while overridden. */
  children: ReactNode;
  className?: string;
}

/**
 * Carries the two patterns the duplication audit asks for everywhere:
 * inherit-with-override (P2) and derive-then-state-the-assumption (P3). A
 * value that a higher level already knows is never an empty required field;
 * it shows what it will use and who said so, and overriding is a deliberate
 * act rather than the default posture.
 *
 * Generalises the angel's-share padlock in `MaturationProfileCard`, which got
 * the idea right but kept its lock state in component-local React state, so a
 * pinned measured value was silently overwritten by the next climate-zone
 * change after a reload. Here the override state is the caller's, which means
 * it is whatever the caller persists.
 *
 * Studio canon: no badge pills. The source note is typographic, the actions
 * are quiet underlined text, and a hairline does the separating.
 */
export function InheritedField({
  label,
  source,
  inheritedValue,
  overridden,
  onOverride,
  onRevert,
  derived = false,
  children,
  className,
}: InheritedFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <FieldLabel
        tag={
          <button
            type="button"
            onClick={overridden ? onRevert : onOverride}
            className="font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] text-studio-dim underline decoration-studio-hairline underline-offset-4 transition-colors duration-150 hover:text-studio-ink hover:decoration-studio-ink"
          >
            {overridden ? 'Use the default' : 'Override'}
          </button>
        }
      >
        {label}
      </FieldLabel>

      {overridden ? (
        children
      ) : (
        <div className="text-[13.5px] leading-tight text-studio-ink">{inheritedValue}</div>
      )}

      <p className="font-mono text-[10px] leading-relaxed text-studio-dim">
        {overridden ? (
          <>This one differs from {source}.</>
        ) : (
          <>
            {derived ? 'Derived from' : 'From'} {source}.
          </>
        )}
      </p>
    </div>
  );
}
