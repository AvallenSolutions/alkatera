import { describe, it, expect } from 'vitest';
import {
  roomPaletteFromBrand,
  resolveRoomPalette,
  DEFAULT_ROOM_PALETTE,
} from '../brand-palette';
import { PLATFORM_ROOMS } from '@/components/studio/platform-rooms';

const COLOURED = ['today', 'workbench', 'cellar', 'network', 'evidence', 'library'] as const;

function parse(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}
function luminance(hex: string): number {
  const [r, g, b] = parse(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe('roomPaletteFromBrand', () => {
  it('falls back to the studio default for missing or invalid colours', () => {
    expect(roomPaletteFromBrand(null)).toEqual(DEFAULT_ROOM_PALETTE);
    expect(roomPaletteFromBrand('not-a-colour')).toEqual(DEFAULT_ROOM_PALETTE);
    expect(roomPaletteFromBrand('#12')).toEqual(DEFAULT_ROOM_PALETTE);
  });

  it('leaves the desk and the wiring in ink, whatever the brand', () => {
    const p = roomPaletteFromBrand('#00D4C0');
    expect(p.wiring).toEqual(DEFAULT_ROOM_PALETTE.wiring);
    expect(p.desk).toEqual(DEFAULT_ROOM_PALETTE.desk);
  });

  it('lands the Today room close to the brand hue', () => {
    // A red brand should make Today (the forest slot) red-family.
    const p = roomPaletteFromBrand('#C0392B');
    const [r, g, b] = parse(p.today.colour);
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
  });

  it('keeps the six coloured rooms distinct (no two identical)', () => {
    const p = roomPaletteFromBrand('#2B46C0');
    const hexes = COLOURED.map((k) => p[k].colour);
    expect(new Set(hexes).size).toBe(hexes.length);
  });

  it('keeps every block legible: cream text only on dark fills, ink on light', () => {
    for (const brand of ['#00D4C0', '#F5C518', '#6D28D9', '#C0392B', '#1E5F5B']) {
      const p = roomPaletteFromBrand(brand);
      for (const k of COLOURED) {
        const lum = luminance(p[k].colour);
        if (p[k].onColour === 'cream') expect(lum).toBeLessThan(0.55);
        else expect(lum).toBeGreaterThan(0.3);
      }
    }
  });

  it('gives a dark, paper-legible accent even for a light (yellow) brand', () => {
    const p = roomPaletteFromBrand('#F5C518');
    for (const k of COLOURED) {
      const [r, g, b] = p[k].accentRgb.split(' ').map(Number);
      expect(luminance('#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join(''))).toBeLessThan(0.5);
    }
  });

  it('is a no-op when seeded with the studio forest itself', () => {
    // delta ≈ 0, so the palette should match the studio anchors closely.
    const p = roomPaletteFromBrand(PLATFORM_ROOMS.today.colour);
    expect(p.today.colour.toUpperCase()).toBe(PLATFORM_ROOMS.today.colour.toUpperCase());
  });
});

describe('resolveRoomPalette', () => {
  it('returns the default when the org has no brand', () => {
    expect(resolveRoomPalette(null)).toEqual(DEFAULT_ROOM_PALETTE);
    expect(resolveRoomPalette({})).toEqual(DEFAULT_ROOM_PALETTE);
  });
  it('prefers a stored palette, then a bare brand colour', () => {
    const stored = roomPaletteFromBrand('#C0392B');
    expect(resolveRoomPalette({ room_palette: stored })).toBe(stored);
    expect(resolveRoomPalette({ brand_colour: '#C0392B' })).toEqual(stored);
  });
});
