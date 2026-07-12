import type { ReactNode } from 'react';
import { Statement } from '@/components/studio/statement';

interface HubHeaderProps {
  /** Mono eyebrow, e.g. "THE WIRING · GOVERNANCE". */
  eyebrow: ReactNode;
  /** One short declarative sentence, ending with a full stop. */
  headline: ReactNode;
  /** One quiet supporting line under the statement. */
  description?: ReactNode;
  /** Right-aligned figures and actions (BigNumbers, PillButtons). */
  children?: ReactNode;
}

/**
 * The one header for the social and governance family hubs: a Statement
 * with an optional quiet description line beneath it.
 */
export function HubHeader({ eyebrow, headline, description, children }: HubHeaderProps) {
  return (
    <div className="space-y-3">
      <Statement eyebrow={eyebrow} headline={headline}>
        {children}
      </Statement>
      {description ? (
        <p className="max-w-xl text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
