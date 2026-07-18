'use client';

import { cn } from '@/lib/utils';
import { REPORT_STYLE_LIST, type ReportStyleId } from '@/lib/pdf/templates/report-styles';

interface StylePickerProps {
  value: ReportStyleId;
  onSelect: (styleId: ReportStyleId) => void;
}

/**
 * The funnel's primary choice: who is this report for. Five style cards in
 * the studio idiom (hairline panels, ink when chosen), with the selected
 * style's three cues underneath.
 */
export function StylePicker({ value, onSelect }: StylePickerProps) {
  const selected = REPORT_STYLE_LIST.find(s => s.id === value);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {REPORT_STYLE_LIST.map(style => {
          const isSelected = style.id === value;
          return (
            <button
              key={style.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(style.id)}
              className={cn(
                'rounded-[6px] border p-4 text-left transition-colors duration-200 ease-studio',
                isSelected
                  ? 'border-studio-ink bg-studio-ink'
                  : 'border-studio-hairline bg-studio-cream hover:border-foreground/40'
              )}
            >
              <div
                className={cn(
                  'font-display text-sm font-semibold leading-snug',
                  isSelected ? 'text-studio-cream' : 'text-foreground'
                )}
              >
                {style.name}
              </div>
              <div
                className={cn(
                  'mt-1 text-xs leading-relaxed',
                  isSelected ? 'text-studio-cream/70' : 'text-muted-foreground'
                )}
              >
                {style.description}
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="rounded-[6px] border border-studio-hairline bg-studio-cream p-4">
          <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.2em] text-studio-dim">
            What this style delivers
          </p>
          <div className="mt-2 space-y-1.5">
            {selected.cues.map(cue => (
              <p key={cue} className="text-xs text-muted-foreground">
                {cue}.
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
