import { cn } from '@/lib/utils';

export interface StageSegment {
  label: string;
  value: number;
}

interface StageBarProps {
  segments: StageSegment[];
  /** Segment fill; defaults to the current room's colour. */
  colour?: string;
  /** Show each segment's value beneath its label. */
  showValues?: boolean;
  className?: string;
}

/**
 * A staged quantity where opacity carries the weight: early stages faint,
 * the final stage full-strength. Labels sit beneath in mono.
 */
export function StageBar({ segments, colour, showValues = false, className }: StageBarProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const n = segments.length;

  return (
    <div className={className}>
      <div className="flex h-1.5 w-full gap-px overflow-hidden rounded-full">
        {segments.map((segment, i) => (
          <div
            key={segment.label}
            className={cn(!colour && 'bg-room')}
            style={{
              width: total > 0 ? `${Math.max((segment.value / total) * 100, 1.5)}%` : `${100 / n}%`,
              opacity: n > 1 ? 0.25 + 0.75 * (i / (n - 1)) : 1,
              ...(colour ? { backgroundColor: colour } : undefined),
            }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between gap-2">
        {segments.map((segment) => (
          <div key={segment.label} className="min-w-0 font-mono text-[9px] uppercase tracking-[0.15em] text-studio-dim">
            <span className="truncate">{segment.label}</span>
            {showValues ? <span className="ml-1.5 font-bold text-foreground">{segment.value}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
