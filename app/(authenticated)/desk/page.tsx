'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/data/useProfile';
import { firstNameFor } from '@/lib/user-name';
import { cn } from '@/lib/utils';
import { BreathingGrid } from '@/components/studio/breathing-grid';
import { PosterBlock } from '@/components/studio/poster-block';
import { Statement } from '@/components/studio/statement';
import { DeskPriorities } from '@/components/studio/desk-priorities';
import { FirstWeekCard } from '@/components/studio/first-week-card';
import { ProvenanceScore } from '@/components/studio/provenance-score';
import { DeskArrivalWalk } from '@/components/studio/desk-arrival-walk';
import {
  PLATFORM_ROOMS,
  deskOrderForPersona,
  roomIsReachable,
  type PlatformRoomKey,
} from '@/components/studio/platform-rooms';
import { useSectionAccess } from '@/lib/access/SectionAccessProvider';
import { canReachPath, type SectionAccess } from '@/lib/access/sections';
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
function posterContent(counts: DeskCounts | null, access: SectionAccess): Record<
  Exclude<PlatformRoomKey, 'desk'>,
  { eyebrow: string; headline: string; note: string; href: string }
> {
  // Today's note names its three surfaces. Naming a room someone has been
  // kept out of is its own small leak, so the note is built from what they
  // can actually open.
  const todayNote = [
    ['BRIEF', '/rosa/'],
    ['PULSE', '/pulse/'],
    ['FINANCIAL', '/pulse/financial/'],
  ]
    .filter(([, href]) => canReachPath(href, access))
    .map(([label]) => label)
    .join(' · ');

  return {
    today: {
      eyebrow: 'TODAY',
      headline: 'The day ahead.',
      note: todayNote,
      href: '/rosa/',
    },
    workbench: {
      eyebrow: 'THE WORKBENCH',
      headline: 'What we measure.',
      note: counts
        ? n(counts.facilities, 'FACILITY', 'FACILITIES') + ' · SPEND · QUALITY'
        : 'FACILITIES · SPEND · QUALITY',
      href: '/workbench/',
    },
    cellar: {
      eyebrow: 'THE CELLAR',
      headline: 'What our drinks are made of.',
      note: counts
        ? n(counts.products, 'PRODUCT', 'PRODUCTS') + ' · LIQUIDS · PACKAGING'
        : 'PRODUCTS · LIQUIDS · PACKAGING',
      href: '/cellar/',
    },
    network: {
      eyebrow: 'THE NETWORK',
      headline: "Who we're talking to.",
      note: 'SUPPLIERS · EXPERTS · MESSAGES',
      href: '/network/',
    },
    evidence: {
      eyebrow: 'THE EVIDENCE',
      headline: 'What we can prove.',
      note: counts
        ? n(counts.reports, 'REPORT', 'REPORTS') + ' · LCAS · VITALITY'
        : 'REPORTS · LCAS · VITALITY',
      href: '/evidence/',
    },
    people: {
      eyebrow: 'OUR PEOPLE',
      headline: 'Who we look after.',
      note: 'PEOPLE · COMMUNITY · GOVERNANCE',
      href: '/people-culture/',
    },
    library: {
      eyebrow: 'THE LIBRARY',
      headline: 'What we know.',
      note: 'YOUR LIBRARY · KNOWLEDGE · WIKI',
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
  const { access: sectionAccess } = useSectionAccess();
  const { profile } = useProfile();
  const { persona } = useUserRole();
  const { currentOrganization } = useOrganization();
  const palette = resolveRoomPalette(currentOrganization);
  // Three sources, best first: the signup name, the profile name, then the
  // email. Reading only user_metadata left anyone who never typed a name
  // (invited, migrated, or signed up without one) on a bare "Good morning."
  const firstName = firstNameFor({
    metadataFullName: user?.user_metadata?.full_name as string | undefined,
    profileFullName: profile?.full_name,
    email: user?.email,
  });
  const [counts, setCounts] = useState<DeskCounts | null>(null);
  // The forest is the desk's ground layer, and the desk's cards sit on top
  // of it. This clears them away so it can be looked at as a picture — the
  // forest key owns the control, the desk owns the fade.
  const [forestOnly, setForestOnly] = useState(false);

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

  const content = posterContent(counts, sectionAccess);
  // Persona order minus the wiring (the quiet ink block below the grid), minus
  // any room this person has nothing left to open in.
  const order = deskOrderForPersona(persona)
    .filter((k) => k !== 'wiring')
    .filter((k) => roomIsReachable(PLATFORM_ROOMS[k], sectionAccess));

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
      {/* The living forest: the org's data completeness, growing. The desk
          is its only home — the rooms are for work, not scenery. */}
      <GrowthFieldMount forestOnly={forestOnly} onForestOnlyChange={setForestOnly} />
      {/* pb-48: the forest's stage. Open paper at the page foot so the
          ground layer (grasses, flowers, understory) is always on show.
          Faded rather than unmounted when the forest is being looked at on
          its own, so coming back costs nothing and scroll is kept. */}
      <div
        className={cn(
          'relative z-[1] space-y-8 pb-48 motion-safe:transition-opacity motion-safe:duration-500 motion-safe:ease-studio',
          forestOnly && 'pointer-events-none opacity-0',
        )}
        aria-hidden={forestOnly}
      >
      <div className="space-y-2">
        <Statement
          eyebrow="THE DESK"
          headline={`${greeting()}${firstName ? `, ${firstName}` : ''}.`}
        />
        {/* The long-term scoreboard: how much of the footprint is confirmed. */}
        <ProvenanceScore />
      </div>

      {/* First desk visit: the walk (auto for migrated users the ritual didn't
          catch; a quiet "Show me around" re-run once seen). */}
      <DeskArrivalWalk />

      {/* What needs you today: Rosa's top priorities, quiet on paper. */}
      <DeskPriorities />

      {/* The first seven days: a named checklist that auto-ticks and retires. */}
      <FirstWeekCard />

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
