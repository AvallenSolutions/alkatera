import type { ReactNode } from 'react';

interface ComplianceNoteProps {
  /** Mono label on the note, defaults to COMPLIANCE. */
  label?: string;
  children: ReactNode;
}

/**
 * The quiet footnote: a dim line under a hairline, not a boxed card.
 */
export function ComplianceNote({ label = 'COMPLIANCE', children }: ComplianceNoteProps) {
  return (
    <p className="border-t border-studio-hairline pt-4 text-xs leading-relaxed text-studio-dim">
      <span className="mr-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em]">
        {label}
      </span>
      {children}
    </p>
  );
}
