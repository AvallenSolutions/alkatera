import type { ReactNode } from 'react';
import { BigNumber } from '@/components/studio/big-number';

export interface SummaryFigure {
  value: ReactNode;
  label: string;
  tone?: 'ink' | 'room' | 'good' | 'attention' | 'stale' | 'hold';
}

/**
 * The hub's figures, once each, on one hairline row. Replaces the old
 * coloured icon-medallion card grid. Null figures show a quiet middle dot.
 */
export function SummaryRow({ figures }: { figures: SummaryFigure[] }) {
  return (
    <div className="flex flex-wrap gap-x-12 gap-y-6 border-y border-studio-hairline py-5">
      {figures.map((figure) => (
        <BigNumber
          key={figure.label}
          value={figure.value ?? '·'}
          label={figure.label}
          tone={figure.tone ?? 'ink'}
        />
      ))}
    </div>
  );
}
