import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Mark } from './mark';
import type { MarkShape, RoomConfig } from './theme';

interface StudioShellProps {
  /** The room this surface belongs to; sets the --room-* variables. */
  room?: RoomConfig;
  /** Direct "R G B" overrides, e.g. the partner's brand colour. */
  roomRgb?: { room: string; accent: string; on: string };
  /** The room band, sticky at the top. */
  band?: ReactNode;
  /** The ink band, sticky at the bottom. */
  inkBand?: ReactNode;
  /** The surface's paper mark, cropped by the page corner. */
  mark?: MarkShape;
  markCorner?: 'br' | 'bl' | 'tr' | 'tl';
  children: ReactNode;
  className?: string;
  /** Constrain and pad the content column (on by default). */
  contained?: boolean;
}

/**
 * Band, statement, paper, band: the anatomy of a room. Work happens on
 * gallery grey between the room's colour band above and ink below.
 */
export function StudioShell({
  room,
  roomRgb,
  band,
  inkBand,
  mark,
  markCorner = 'tr',
  children,
  className,
  contained = true,
}: StudioShellProps) {
  const vars: CSSProperties | undefined =
    room || roomRgb
      ? ({
          '--room-rgb': roomRgb?.room ?? room?.rgb,
          '--room-accent-rgb': roomRgb?.accent ?? room?.accentRgb,
          '--room-on-rgb': roomRgb?.on ?? room?.onRgb,
        } as CSSProperties)
      : undefined;

  return (
    <div
      className={cn('flex min-h-screen flex-col bg-studio-paper text-foreground', className)}
      style={vars}
    >
      {band}
      <main className="relative w-full flex-1 overflow-hidden">
        {mark ? <Mark shape={mark} corner={markCorner} className="h-56 w-56 md:h-72 md:w-72" /> : null}
        <div
          className={cn(
            'relative h-full',
            contained && 'mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10'
          )}
        >
          {children}
        </div>
      </main>
      {inkBand}
    </div>
  );
}
