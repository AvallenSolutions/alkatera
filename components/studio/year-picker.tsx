'use client';

import { cn } from '@/lib/utils';

/**
 * The studio's year control: mono years on a hairline, the current one inked
 * and underlined.
 *
 * Replaces a bare `<select>`, which was the only native form control left on
 * the vitality page and read as a browser widget dropped into a designed
 * surface. With four years there is nothing to collapse into a menu — showing
 * them costs one line and removes a click.
 */
export function YearPicker({
  years,
  value,
  onChange,
  className,
}: {
  years: number[];
  value: number;
  onChange: (year: number) => void;
  className?: string;
}) {
  return (
    <div
      className={cn('flex items-center gap-5', className)}
      role="group"
      aria-label="Reporting year"
    >
      {years.map((year) => {
        const active = year === value;
        return (
          <button
            key={year}
            type="button"
            onClick={() => onChange(year)}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'border-b-2 pb-1 font-mono text-[11px] font-bold uppercase tracking-[0.18em] transition-colors duration-150 ease-studio',
              active
                ? 'border-room-accent text-foreground'
                : 'border-transparent text-studio-dim hover:text-foreground',
            )}
          >
            {year}
          </button>
        );
      })}
    </div>
  );
}
