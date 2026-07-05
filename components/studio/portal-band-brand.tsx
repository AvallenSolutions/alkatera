'use client';

import { useDistributor } from '@/lib/distributor/context';

/**
 * The band's identity slot: the partner's logo when the portal is worn
 * by a procurement client, otherwise the room's name.
 */
export function PortalBandBrand({ roomName }: { roomName: string }) {
  const { partnerProcurement } = useDistributor();

  if (partnerProcurement?.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={partnerProcurement.logo_url}
        alt={partnerProcurement.display_name ?? partnerProcurement.name}
        className="h-6 w-auto shrink-0"
      />
    );
  }

  return (
    <span className="shrink-0 font-display text-sm font-semibold tracking-[-0.01em]">
      {roomName}
    </span>
  );
}
