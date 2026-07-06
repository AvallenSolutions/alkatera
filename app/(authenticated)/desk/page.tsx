'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { BreathingGrid } from '@/components/studio/breathing-grid';
import { PosterBlock } from '@/components/studio/poster-block';
import { Statement } from '@/components/studio/statement';
import { PLATFORM_ROOMS } from '@/components/studio/platform-rooms';

interface DeskCounts {
  products: number;
  facilities: number;
  reports: number;
}

/**
 * The desk: the hall of the house. The rooms as breathing poster blocks
 * with live mono notes; the assistant's ink strip sits beneath (mounted
 * by AppLayout).
 */

/** "1 PRODUCT", "3 PRODUCTS": mono notes count in plain words. */
function n(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DeskPage() {
  const { user } = useAuth();
  const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0];
  const [counts, setCounts] = useState<DeskCounts | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/desk/counts')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setCounts(data);
      })
      .catch(() => {
        // The desk stays quiet if the counts are unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rooms = PLATFORM_ROOMS;

  return (
    <div className="space-y-8">
      <Statement
        eyebrow="THE DESK"
        headline={`${greeting()}${firstName ? `, ${firstName}` : ''}.`}
      />

      <BreathingGrid>
        <PosterBlock
          eyebrow="TODAY"
          headline="The day ahead."
          note="BRIEF · PULSE · TARGETS"
          href="/rosa/"
          colour={rooms.today.colour}
          on={rooms.today.onColour}
          mark={rooms.today.mark}
          className="min-h-[16rem]"
        />
        <PosterBlock
          eyebrow="THE MEASURES"
          headline="What we measure."
          note={
            counts
              ? `${n(counts.products, 'PRODUCT', 'PRODUCTS')} · ${n(counts.facilities, 'FACILITY', 'FACILITIES')}`
              : 'FACILITIES · EMISSIONS · PRODUCTS'
          }
          href="/company/facilities/"
          colour={rooms.measures.colour}
          on={rooms.measures.onColour}
          mark={rooms.measures.mark}
          className="min-h-[16rem]"
        />
        <PosterBlock
          eyebrow="THE EVIDENCE"
          headline="What we can prove."
          note={
            counts
              ? `${n(counts.reports, 'REPORT', 'REPORTS')} · CERTIFICATIONS · EPR`
              : 'REPORTS · CERTIFICATIONS · EPR'
          }
          href="/reports/"
          colour={rooms.evidence.colour}
          on={rooms.evidence.onColour}
          mark={rooms.evidence.mark}
          className="min-h-[16rem]"
        />
        <PosterBlock
          eyebrow="THE POST"
          headline="Who we're talking to."
          note="MESSAGES · SUPPORT · EXPERTS"
          href="/settings/messages/"
          colour={rooms.post.colour}
          on={rooms.post.onColour}
          mark={rooms.post.mark}
          className="min-h-[16rem]"
        />
      </BreathingGrid>

      <PosterBlock
        eyebrow="SETTINGS"
        headline="The wiring."
        note="ORGANISATION · INTEGRATIONS · BILLING"
        href="/settings/"
        colour={rooms.wiring.colour}
        on={rooms.wiring.onColour}
        mark={rooms.wiring.mark}
        className="min-h-[7rem]"
      />
    </div>
  );
}
