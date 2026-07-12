'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { BreathingGrid } from '@/components/studio/breathing-grid';
import { PosterBlock } from '@/components/studio/poster-block';
import { Statement } from '@/components/studio/statement';
import { DeskPriorities } from '@/components/studio/desk-priorities';
import { DeskWelcome } from '@/components/studio/desk-welcome';
import {
  PLATFORM_ROOMS,
  deskOrderForPersona,
  type PlatformRoomKey,
} from '@/components/studio/platform-rooms';
import { useUserRole } from '@/lib/rosa/useUserRole';
import { useOrganization } from '@/lib/organizationContext';
import { resolveRoomPalette } from '@/lib/studio/brand-palette';
import { VitalityHero } from '@/components/vitality/VitalityHero';
import { GrowthFieldMount } from '@/components/studio/growth/growth-field-mount';

interface DeskCounts {
  products: number;
  facilities: number;
  reports: number;
}

/**
 * The desk: the hall of the house. The rooms as breathing poster blocks
 * in the order that suits the user's persona, each with a live mono
 * note; "what needs you today" leads, the assistant's ink strip sits
 * beneath (mounted by AppLayout).
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

/** The desk face of each room: eyebrow, its one sentence, where it opens. */
function posterContent(counts: DeskCounts | null): Record<
  Exclude<PlatformRoomKey, 'desk'>,
  { eyebrow: string; headline: string; note: string; href: string }
> {
  return {
    today: {
      eyebrow: 'TODAY',
      headline: 'The day ahead.',
      note: 'BRIEF · PULSE · FINANCIAL',
      href: '/rosa/',
    },
    workbench: {
      eyebrow: 'THE WORKBENCH',
      headline: 'What we measure.',
      note: counts
        ? n(counts.facilities, 'FACILITY', 'FACILITIES') + ' · EMISSIONS · SPEND'
        : 'FACILITIES · EMISSIONS · SPEND',
      href: '/workbench/',
    },
    cellar: {
      eyebrow: 'THE CELLAR',
      headline: 'What we make.',
      note: counts
        ? n(counts.products, 'PRODUCT', 'PRODUCTS') + ' · LCAS'
        : 'PRODUCTS · LCAS',
      href: '/cellar/',
    },
    network: {
      eyebrow: 'THE NETWORK',
      headline: "Who we're talking to.",
      note: 'SUPPLIERS · MESSAGES · EXPERTS',
      href: '/network/',
    },
    evidence: {
      eyebrow: 'THE EVIDENCE',
      headline: 'What we can prove.',
      note: counts
        ? n(counts.reports, 'REPORT', 'REPORTS') + ' · CERTIFICATIONS · TARGETS'
        : 'REPORTS · CERTIFICATIONS · TARGETS',
      href: '/evidence/',
    },
    library: {
      eyebrow: 'THE LIBRARY',
      headline: 'What we know.',
      note: 'KNOWLEDGE · WIKI',
      href: '/library/',
    },
    wiring: {
      eyebrow: 'THE WIRING',
      headline: 'The wiring.',
      note: 'SETTINGS · INTEGRATIONS · COMPLIANCE',
      href: '/wiring/',
    },
  };
}

export default function DeskPage() {
  const { user } = useAuth();
  const { persona } = useUserRole();
  const { currentOrganization } = useOrganization();
  const palette = resolveRoomPalette(currentOrganization);
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

  const content = posterContent(counts);
  // Persona order minus the wiring (the quiet ink block below the grid).
  const order = deskOrderForPersona(persona).filter((k) => k !== 'wiring');

  const block = (key: Exclude<PlatformRoomKey, 'desk' | 'wiring'>): ReactNode => {
    const room = PLATFORM_ROOMS[key];
    const c = content[key];
    return (
      <PosterBlock
        key={key}
        id={`desk-poster-${key}`}
        eyebrow={c.eyebrow}
        headline={c.headline}
        note={c.note}
        href={c.href}
        colour={palette[key].colour}
        on={palette[key].onColour}
        mark={room.mark}
        className="min-h-[15rem]"
      />
    );
  };

  return (
    <>
      {/* The living forest: the org's data completeness, growing. */}
      <GrowthFieldMount />
      {/* pb-48: the forest's stage. Open paper at the page foot so the
          ground layer (grasses, flowers, understory) is always on show. */}
      <div className="relative z-[1] space-y-8 pb-48">
      <Statement
        eyebrow="THE DESK"
        headline={`${greeting()}${firstName ? `, ${firstName}` : ''}.`}
      />

      {/* First desk visit only: a slim welcome + optional room walkthrough. */}
      <DeskWelcome />

      {/* What needs you today: Rosa's top priorities, quiet on paper. */}
      <DeskPriorities />

      {/* The key numbers greet you in the hall: the vitality panel. */}
      <VitalityHero />

      {/* The rooms as breathing poster blocks, in persona order. */}
      <BreathingGrid>
        {order.map((key) => block(key as Exclude<PlatformRoomKey, 'desk' | 'wiring'>))}
      </BreathingGrid>

      {/* The wiring sits quietly in ink beneath the colours. */}
      <PosterBlock
        id="desk-poster-wiring"
        eyebrow={content.wiring.eyebrow}
        headline={content.wiring.headline}
        note={content.wiring.note}
        href={content.wiring.href}
        colour={PLATFORM_ROOMS.wiring.colour}
        on={PLATFORM_ROOMS.wiring.onColour}
        mark={PLATFORM_ROOMS.wiring.mark}
        className="min-h-[7rem]"
      />
      </div>
    </>
  );
}
