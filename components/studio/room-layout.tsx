import type { ReactNode } from 'react';
import { UpgradeBanner } from '@/components/distributor/upgrade/upgrade-banner';
import { InkBand } from './ink-band';
import { PortalBandBrand } from './portal-band-brand';
import { RoomBand } from './room-band';
import { StudioShell } from './studio-shell';
import { ROOMS, type RoomKey } from './theme';

interface RoomLayoutProps {
  room: RoomKey;
  /** The room's one primary action, shown in the ink band. */
  action?: ReactNode;
  children: ReactNode;
}

/** Band, statement, paper, band: the shared shell for every portal room. */
export function RoomLayout({ room: key, action, children }: RoomLayoutProps) {
  const room = ROOMS[key];
  return (
    <StudioShell
      room={room}
      mark={room.mark}
      band={<RoomBand room={room} brand={<PortalBandBrand roomName={room.name} />} />}
      inkBand={<InkBand action={action} tabs={room.tabs} />}
    >
      <UpgradeBanner />
      {children}
    </StudioShell>
  );
}
