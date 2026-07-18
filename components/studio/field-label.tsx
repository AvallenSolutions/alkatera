import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FieldLabelProps {
  children: ReactNode;
  /** Adds a quiet "· required" marker after the label. */
  required?: boolean;
  /** Trailing slot on the same baseline, e.g. a provenance tag. */
  tag?: ReactNode;
  className?: string;
}

/**
 * Mono field label: the studio's eyebrow for a form field. A quiet 9.5px
 * cap over its control, with an optional required marker and a trailing tag
 * slot (provenance, status). Hairlines between rows do the separating, so
 * this never draws a box of its own.
 *
 * Distinct from Eyebrow, which titles sections and tabs at a slightly larger
 * scale in the room's accent; a field label is always dim and a touch
 * smaller, sitting inside a fact panel rather than over a section.
 */
export function FieldLabel({ children, required, tag, className }: FieldLabelProps) {
  return (
    <div className={cn('flex items-center justify-between gap-2', className)}>
      <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.2em] text-studio-dim">
        {children}
        {required && <span className="text-studio-stale"> · required</span>}
      </span>
      {tag}
    </div>
  );
}
