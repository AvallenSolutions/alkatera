import type { ReactNode } from 'react';
import { Eyebrow } from '@/components/studio/eyebrow';

interface SectionProps {
  /** Mono section label, e.g. "THE RECORDS". */
  label: string;
  /** One quiet line under the label. */
  blurb?: string;
  children: ReactNode;
}

/** A quiet section: mono eyebrow on a hairline, then the work. */
export function Section({ label, blurb, children }: SectionProps) {
  return (
    <section className="space-y-4">
      <div className="border-b border-studio-hairline pb-2">
        <Eyebrow>{label}</Eyebrow>
        {blurb ? <p className="mt-1 text-xs text-muted-foreground">{blurb}</p> : null}
      </div>
      {children}
    </section>
  );
}
