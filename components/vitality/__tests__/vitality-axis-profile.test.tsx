import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VitalityAxisProfile } from '../VitalityAxisProfile';
import { CHART } from '@/components/studio/theme';
import type { VitalityComposite } from '@/lib/vitality/composite';

/**
 * The profile's whole job is to be honest about shape, so the thing worth
 * testing is the distinction the visual exists to preserve: a measured zero is
 * NOT the same fact as no measurement, and neither may be drawn as a score.
 *
 * This is also why the plan rejected a radar. A radar plots zero at the centre
 * and joins the points, so three axes at 0 still enclose an area — it draws a
 * shape where there is no data. Bars cannot do that, and these assertions keep
 * it that way.
 */

const composite = (over: Partial<VitalityComposite> = {}): VitalityComposite =>
  ({
    composite: 34,
    band: 'EMERGING',
    weights: { e: 0.5, s: 0.25, g: 0.25 },
    e: { score: 64, has_data: true, sub: { climate: 60, water: 46, circularity: 58, nature: 100 } },
    s: { score: 2, has_data: true, sub: { community: 6, people_culture: null, supplier_esg: 0 } },
    g: { score: 5, has_data: true, sub: { governance: null, certifications: 14 } },
    generated_at: '2026-07-24T00:00:00.000Z',
    ...over,
  }) as unknown as VitalityComposite;

describe('VitalityAxisProfile', () => {
  it('renders nothing without a composite, rather than an empty frame', () => {
    const { container } = render(<VitalityAxisProfile composite={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('draws all nine axes, including the ones with no data', () => {
    render(<VitalityAxisProfile composite={composite()} />);
    const bars = document.querySelectorAll('div[title]');
    expect(bars).toHaveLength(9);
  });

  it('separates a measured zero from no score at all', () => {
    render(<VitalityAxisProfile composite={composite()} />);

    // Supplier ESG genuinely scored 0 — we counted and found nothing.
    const zero = screen.getByTitle('Suppliers: 0');
    // People & culture has never been measured.
    const missing = screen.getByTitle('People: nothing yet');

    expect(zero.getAttribute('title')).toContain('0');
    expect(missing.getAttribute('title')).toContain('nothing yet');

    // The measured zero carries a coloured baseline rule; the unmeasured axis
    // carries no drawn element at all. If these ever render identically the
    // page has started claiming a reading it does not have.
    const zeroFill = zero.querySelector('div[style*="background-color"]');
    const missingFill = missing.querySelector('div[style*="background-color"]');
    expect(zeroFill).not.toBeNull();
    expect(missingFill).toBeNull();
  });

  it('colours each bar by its pillar, not by how good the score is', () => {
    render(<VitalityAxisProfile composite={composite()} />);
    // Only the colour, not the whole style string — the heights differ by score.
    const colourOf = (title: string) => {
      const style =
        screen.getByTitle(title).querySelector('div[style*="background-color"]')?.getAttribute('style') ?? '';
      return (style.match(/background-color:\s*([^;]+)/) ?? [, ''])[1].trim();
    };

    // Asserted against the palette tokens rather than literal rgb(), so a
    // validated palette change does not break a test about pillar grouping.
    // The invariant is what matters: Nature at 100 and Climate at 60 are the
    // SAME colour because they are the same pillar. Tone would double-encode
    // the number and turn the profile into a traffic light.
    expect(colourOf('Climate: 60')).toBe(colourOf('Nature: 100'));
    expect(colourOf('Water: 46')).toBe(colourOf('Climate: 60'));

    // ...and the three pillars are three different colours.
    const env = colourOf('Climate: 60');
    const people = colourOf('Community: 6');
    const gov = colourOf('Certs: 14');
    expect(new Set([env, people, gov]).size).toBe(3);

    // Each is a declared series slot, not an ad-hoc colour.
    const toRgb = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
    };
    expect(env).toBe(toRgb(CHART.series[0]));
    expect(people).toBe(toRgb(CHART.series[1]));
    expect(gov).toBe(toRgb(CHART.series[2]));
  });

  it('scales bar height as a straight percentage of the score', () => {
    render(<VitalityAxisProfile composite={composite()} />);
    const heightOf = (title: string) =>
      screen.getByTitle(title).querySelector('div[style*="height"]')?.getAttribute('style') ?? '';

    expect(heightOf('Climate: 60')).toContain('height: 60%');
    expect(heightOf('Nature: 100')).toContain('height: 100%');
    expect(heightOf('Water: 46')).toContain('height: 46%');
  });

  it('clamps a score outside 0-100 instead of overflowing the track', () => {
    render(
      <VitalityAxisProfile
        composite={composite({
          e: { score: 64, has_data: true, sub: { climate: 140, water: -20, circularity: 58, nature: 100 } },
        } as any)}
      />,
    );
    const style = screen.getByTitle('Climate: 100').querySelector('div[style*="height"]')?.getAttribute('style');
    expect(style).toContain('height: 100%');
    // A negative score falls to the measured-zero baseline, not a negative bar.
    expect(screen.getByTitle('Water: 0')).toBeTruthy();
  });

  it('states the same nine facts in text for anyone not reading bars', () => {
    render(<VitalityAxisProfile composite={composite()} />);
    const items = [...document.querySelectorAll('.sr-only li')].map((li) => li.textContent);
    expect(items).toHaveLength(9);
    expect(items).toContain('Climate: 60 out of 100');
    expect(items).toContain('People: no score yet');
    expect(items).toContain('Suppliers: 0 out of 100');
  });
});
