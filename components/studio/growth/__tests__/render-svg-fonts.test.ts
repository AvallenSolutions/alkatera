import { describe, it, expect } from 'vitest';
import { buildForestSvg } from '../render-svg';

/**
 * The downloaded forest is the one artefact that leaves the app and gets put
 * in front of other people — a deck, an email, a wall. It shipped with the
 * headline on a generic system sans, so the wordmark was not the wordmark.
 *
 * Easy to lose again silently, since nothing else in the app renders through
 * this path.
 */
describe('forest SVG export: fonts', () => {
  const svg = buildForestSvg({
    seed: 'alkatera-drinks-co',
    score: 69,
    caption: { brand: 'alkatera Drinks Co', user: 'tim@alkatera.com', date: '24 July 2026' },
  });

  const textNode = (contains: string) =>
    svg.match(new RegExp('<text[^>]*>[^<]*' + contains + '[^<]*</text>'))?.[0] ?? '';

  it('the brand headline leads with the studio display face', () => {
    const headline = textNode('alkatera Drinks Co');
    expect(headline).toContain("'Bricolage Grotesque'");
    // A fallback stack must remain: the file is opened outside the app, where
    // no webfont the page loaded is available.
    expect(headline).toContain('sans-serif');
  });

  it('the provenance stamp stays mono — only the headline changed', () => {
    const stamp = textNode('GROWN FROM OUR DATA');
    expect(stamp).toContain('ui-monospace');
    expect(stamp).not.toContain('Bricolage');
  });
});
