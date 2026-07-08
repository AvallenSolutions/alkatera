'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { PLATFORM_ROOMS, type PlatformRoomKey } from '@/components/studio/platform-rooms';
import { roomPaletteFromBrand } from '@/lib/studio/brand-palette';

const PREVIEW_ROOMS: PlatformRoomKey[] = [
  'today',
  'workbench',
  'cellar',
  'network',
  'evidence',
  'library',
];

interface BrandColourRevealProps {
  /** The starting colour (scraped from the site, or the studio forest). */
  initialColour?: string | null;
  /** Called with the chosen hex when the user applies it. */
  onApply: (hex: string) => void | Promise<void>;
  applyLabel?: string;
  busy?: boolean;
  className?: string;
}

const isHex = (s: string) => /^#[0-9a-fA-F]{6}$/.test(s);

/**
 * The surprise: we paint the house of rooms in the brand's colour. The
 * user sees the six rooms repaint live and can nudge the seed colour, then
 * apply. Reused on the onboarding reveal and in Settings.
 */
export function BrandColourReveal({
  initialColour,
  onApply,
  applyLabel = 'Paint my house',
  busy = false,
  className,
}: BrandColourRevealProps) {
  const start = initialColour && isHex(initialColour) ? initialColour.toUpperCase() : '#205E40';
  const [colour, setColour] = useState(start);

  const palette = useMemo(() => roomPaletteFromBrand(colour), [colour]);

  return (
    <div className={cn('space-y-5', className)}>
      {/* The rooms, repainting live. */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {PREVIEW_ROOMS.map((key) => {
          const entry = palette[key];
          const text = entry.onColour === 'ink' ? '#1A1B1D' : '#F2F1EA';
          return (
            <div
              key={key}
              className="flex h-20 flex-col justify-end rounded-[6px] p-2.5 transition-colors duration-200 ease-studio"
              style={{ backgroundColor: entry.colour }}
            >
              <span
                className="font-mono text-[8px] font-bold uppercase tracking-[0.16em] opacity-80"
                style={{ color: text }}
              >
                {PLATFORM_ROOMS[key].name.replace(/^The /, '').replace(/\.$/, '')}
              </span>
            </div>
          );
        })}
      </div>

      {/* Nudge the seed colour. */}
      <div className="flex items-center gap-3">
        <label className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-[6px] border border-border">
          <span className="block h-full w-full" style={{ backgroundColor: colour }} />
          <input
            type="color"
            value={colour}
            onChange={(e) => setColour(e.target.value.toUpperCase())}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Brand colour"
          />
        </label>
        <input
          type="text"
          value={colour}
          onChange={(e) => {
            const v = e.target.value.toUpperCase();
            setColour(v.startsWith('#') ? v : `#${v}`);
          }}
          spellCheck={false}
          className="w-28 rounded-[6px] border border-border bg-card px-3 py-2 font-mono text-xs uppercase tracking-[0.1em] text-foreground outline-none focus:border-room-accent"
          aria-label="Brand colour hex"
        />
        <button
          type="button"
          disabled={busy || !isHex(colour)}
          onClick={() => onApply(colour)}
          className="ml-auto rounded-full bg-primary px-5 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-primary-foreground transition-opacity duration-150 ease-studio hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Painting…' : applyLabel}
        </button>
      </div>
    </div>
  );
}
