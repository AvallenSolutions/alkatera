'use client';

/**
 * Pulse -- persona / view switcher.
 *
 * A segmented control over the three persona presets plus an "Advanced" pill
 * that drops into the full customisable grid. Persona views are curated and
 * read-only; Advanced is the legacy drag/pin/add experience.
 */

import { LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PERSONAS, type Persona, type PulseView } from '@/lib/pulse/layout';

const PERSONA_ORDER: Persona[] = ['founder', 'cfo', 'sustainability'];

export function PulsePersonaToggle({
  view,
  onChange,
}: {
  view: PulseView;
  onChange: (next: PulseView) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-card/40 p-1">
      {PERSONA_ORDER.map(id => {
        const active = view === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={active}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition',
              active
                ? 'bg-[#ccff00] text-black'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {PERSONAS[id].label}
          </button>
        );
      })}

      <span className="mx-0.5 h-4 w-px bg-border/60" aria-hidden="true" />

      <button
        type="button"
        onClick={() => onChange('advanced')}
        aria-pressed={view === 'advanced'}
        title="Build your own dashboard from every available metric"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition',
          view === 'advanced'
            ? 'bg-[#ccff00] text-black'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Advanced
      </button>
    </div>
  );
}
