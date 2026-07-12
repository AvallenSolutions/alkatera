/**
 * Room-segmented onboarding — the registry.
 *
 * One entry per room that gets a setup panel: a plain-language intro
 * sentence (shown once, first visit) and the growth bands whose signals
 * feed the room's checklist. The checklist items themselves are never
 * hard-coded here — they come straight from the live signals returned by
 * GET /api/growth (see lib/desk/growth-score.ts's computeGrowthSignals),
 * filtered down to these bands, so the room checklist, the desk
 * priorities and the forest can never disagree.
 *
 * The library has an entry with an empty band list — intro only, no
 * checklist, because its "room" has no growth-score signals of its own.
 * Today's entry is also band-less (its band coverage is handled by the
 * desk priorities, not a RoomSetupPanel — nothing mounts one for 'today')
 * but keeps an intro sentence so the desk's first-visit tour
 * (components/studio/desk-welcome.tsx) has one to reuse.
 *
 * See tasks/onboarding-support-plan.md, Phase 2.
 */

import type { PlatformRoomKey } from '@/components/studio/platform-rooms'
import type { GrowthBandKey } from '@/lib/desk/growth-score'

export interface RoomGuide {
  /** One plain-language sentence: what this room is for. British English, no em dashes, full stop. */
  intro: string
  /** Growth bands whose signals populate this room's checklist. Empty = intro only. */
  bands: GrowthBandKey[]
}

export const ROOM_GUIDES: Partial<Record<PlatformRoomKey, RoomGuide>> = {
  today: {
    intro: 'Today is your daily brief: what needs you, and how the numbers are moving.',
    bands: [],
  },
  workbench: {
    intro:
      'The workbench is where your operational data lives: facilities, energy, spend and everything you measure.',
    bands: ['measurement', 'production'],
  },
  cellar: {
    intro:
      'The cellar is where your products become footprints: recipes, packaging and the life-cycle assessment behind each one.',
    bands: ['production'],
  },
  network: {
    intro:
      'The network is where you reach the people around you: suppliers, messages and the experts you can call on.',
    bands: ['network'],
  },
  evidence: {
    intro:
      'The evidence is where your work becomes proof: reports, certifications and the targets you are working towards.',
    bands: ['evidence', 'stewardship'],
  },
  wiring: {
    intro:
      'The wiring is the quiet machinery behind everything else: settings, billing, compliance and the rest of the platform.',
    bands: ['foundations'],
  },
  library: {
    intro:
      'The library is your reference shelf: the knowledge bank and the wiki, whenever you need to look something up.',
    bands: [],
  },
}

/** Cap on how many checklist items a room's setup panel shows at once. */
export const ROOM_CHECKLIST_LIMIT = 5
