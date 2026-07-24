import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLATFORM_ROOMS, DESK_ORDER, roomShortName } from '@/components/studio/platform-rooms';

/**
 * The Walk keeps its own hardcoded room list rather than deriving from
 * PLATFORM_ROOMS, because each card carries bespoke copy and a data line that
 * the registry has no business knowing about. The cost of that is drift: when
 * the people room was added, the walk silently kept teaching the old house and
 * nobody would have noticed until a new customer was shown seven rooms out of
 * eight.
 *
 * This reads the source rather than importing the component, so it stays a
 * cheap string check and needs no DOM, no fonts and no onboarding context.
 */

const SRC = readFileSync(join(__dirname, '..', 'TheWalk.tsx'), 'utf8');

/** Every room a user actually walks into — the desk is the hall, not a room. */
const COLOURED_ROOMS = DESK_ORDER.filter((key) => key !== 'wiring');

describe('The Walk covers the whole house', () => {
  it('has a card for every coloured room', () => {
    const missing = COLOURED_ROOMS.filter((key) => !SRC.includes(`key: '${key}'`));
    expect(
      missing,
      `These rooms exist in PLATFORM_ROOMS but have no card in The Walk, so a ` +
        `new customer is never shown them: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('names every room on the explainer index, the wiring included', () => {
    for (const key of DESK_ORDER) {
      const name = roomShortName(PLATFORM_ROOMS[key]);
      // The explainer lists rooms by their display name ("The cellar", "Our people").
      const listed = SRC.includes(`name: 'The ${name.toLowerCase()}'`) || SRC.includes(`name: '${name}'`);
      expect(`${key}: ${listed}`).toBe(`${key}: true`);
    }
  });

  it('gives every card a mark the walk can actually draw', () => {
    // The walk re-implements mark geometry rather than importing <Mark/>, so a
    // room with a new shape renders nothing until a case is added here too.
    for (const key of COLOURED_ROOMS) {
      const shape = PLATFORM_ROOMS[key].mark;
      expect(`${key}/${shape}: ${SRC.includes(`case '${shape}':`)}`).toBe(`${key}/${shape}: true`);
    }
  });

  it('tells the user the right number of rooms', () => {
    expect(SRC).toContain('one of eight rooms');
    expect(DESK_ORDER).toHaveLength(8);
  });
});
