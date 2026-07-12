import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Statement } from '@/components/studio/statement';

interface TopicHeaderProps {
  /** Mono eyebrow, e.g. "THE WIRING · GOVERNANCE". */
  eyebrow: ReactNode;
  /** One short declarative sentence, ending with a full stop. */
  headline: ReactNode;
  /** One quiet supporting line under the statement. */
  description?: ReactNode;
  /** In-room back link to the family hub, restyled quiet. */
  backHref?: string;
  backLabel?: string;
  /** Right-aligned figures and actions (BigNumbers, PillButtons, dialogs). */
  children?: ReactNode;
}

/**
 * The one header for the thirteen social and governance detail pages:
 * a quiet mono back link to the family hub, then the Statement.
 */
export function TopicHeader({
  eyebrow,
  headline,
  description,
  backHref,
  backLabel,
  children,
}: TopicHeaderProps) {
  return (
    <div className="space-y-3">
      {backHref ? (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" aria-hidden="true" />
          {backLabel ?? 'Back'}
        </Link>
      ) : null}
      <Statement eyebrow={eyebrow} headline={headline}>
        {children}
      </Statement>
      {description ? (
        <p className="max-w-xl text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
