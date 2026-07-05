import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { MonoTabs } from './mono-tabs';
import type { RoomConfig, RoomTab } from './theme';

interface RoomBandProps {
  room: RoomConfig;
  /** Override the room's default tabs (e.g. gated surfaces removed). */
  tabs?: RoomTab[];
  /** Live mono note on the right, e.g. "12 AWAIT APPROVAL". */
  note?: ReactNode;
  /** Replaces the room name with a partner logo in whitelabel mode. */
  brand?: ReactNode;
  /** Where the desk link points; the platform hall is /desk. */
  deskHref?: string;
  /** Controls pinned to the far right (bell, account), after the note. */
  endSlot?: ReactNode;
  className?: string;
}

/** The desk link: four panes, one hall. */
function DeskLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      aria-label="The desk"
      className="grid shrink-0 grid-cols-2 gap-[3px] p-1 opacity-75 transition-opacity duration-150 ease-studio hover:opacity-100"
    >
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="h-[5px] w-[5px] bg-current" />
      ))}
    </Link>
  );
}

/**
 * The room band: sticky, 52px, the room's colour. Desk link, the room's
 * name, its surfaces as mono tabs, a live mono note on the right.
 */
export function RoomBand({
  room,
  tabs,
  note,
  brand,
  deskHref = '/desk',
  endSlot,
  className,
}: RoomBandProps) {
  return (
    <div className={cn('sticky top-0 z-40 h-[52px] bg-room text-room-on', className)}>
      <div className="mx-auto flex h-full max-w-6xl items-center gap-6 px-4 md:px-6">
        <DeskLink href={deskHref} />
        {brand ?? (
          <span className="shrink-0 font-display text-sm font-semibold tracking-[-0.01em]">
            {room.name}
          </span>
        )}
        <MonoTabs tabs={tabs ?? room.tabs} className="min-w-0 flex-1 overflow-x-auto" />
        {note ? (
          <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] opacity-80 md:block">
            {note}
          </span>
        ) : null}
        {endSlot}
      </div>
    </div>
  );
}
