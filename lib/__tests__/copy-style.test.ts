/**
 * House copy style tests.
 *
 * scrubEmDashes runs on generated copy that reaches users without review, so
 * its edge cases (placeholder dashes, dashes next to existing punctuation,
 * trailing dashes) matter more than the happy path.
 */

import { describe, it, expect } from 'vitest';
import { scrubEmDashes, NO_EM_DASH_RULE, HOUSE_STYLE } from '../copy-style';

describe('scrubEmDashes', () => {
  it('replaces a spaced em dash with a comma', () => {
    expect(scrubEmDashes('Packaging is the biggest driver — it is 62% of the total.')).toBe(
      'Packaging is the biggest driver, it is 62% of the total.',
    );
  });

  it('replaces an unspaced em dash', () => {
    expect(scrubEmDashes('glass bottles—the heaviest item')).toBe('glass bottles, the heaviest item');
  });

  it('replaces en dashes too', () => {
    expect(scrubEmDashes('Write a 2–3 paragraph overview')).toBe('Write a 2, 3 paragraph overview');
  });

  it('handles several dashes in one string', () => {
    expect(scrubEmDashes('First — second — third')).toBe('First, second, third');
  });

  it('leaves a standalone dash placeholder alone', () => {
    // The empty-state marker used in tables and stat tiles.
    expect(scrubEmDashes('—')).toBe('—');
    expect(scrubEmDashes(' — ')).toBe(' — ');
    expect(scrubEmDashes('–')).toBe('–');
  });

  it('does not double up punctuation when a dash follows a comma', () => {
    expect(scrubEmDashes('Packaging, — the biggest driver')).toBe('Packaging, the biggest driver');
  });

  it('does not leave a comma stranded before a full stop', () => {
    expect(scrubEmDashes('That is the whole story —.')).toBe('That is the whole story.');
  });

  it('drops a trailing comma left by a dash at the end', () => {
    expect(scrubEmDashes('More to come —')).toBe('More to come');
  });

  it('collapses the double spaces a replacement can leave', () => {
    expect(scrubEmDashes('one  —  two')).toBe('one, two');
  });

  it('leaves copy with no dashes untouched', () => {
    const clean = 'Packaging is 62% of this footprint. Switching to lighter glass is the fastest win.';
    expect(scrubEmDashes(clean)).toBe(clean);
  });

  it('leaves hyphens in compound words untouched', () => {
    expect(scrubEmDashes('cradle-to-grave end-of-life')).toBe('cradle-to-grave end-of-life');
  });

  it('handles empty and whitespace input', () => {
    expect(scrubEmDashes('')).toBe('');
    expect(scrubEmDashes('   ')).toBe('   ');
  });

  it('is idempotent', () => {
    const once = scrubEmDashes('Packaging — the biggest driver — is 62%.');
    expect(scrubEmDashes(once)).toBe(once);
  });
});

describe('house style constants', () => {
  it('NO_EM_DASH_RULE names both dash characters it forbids', () => {
    expect(NO_EM_DASH_RULE).toContain('—');
    expect(NO_EM_DASH_RULE).toContain('–');
  });

  it('HOUSE_STYLE carries the em dash rule', () => {
    expect(HOUSE_STYLE).toContain(NO_EM_DASH_RULE);
  });

  it('the style guidance does not itself contain prose em dashes', () => {
    // A prompt that forbids em dashes while using one gives the model
    // contradictory signals. The only dashes here are the quoted characters
    // the rule names, which sit inside brackets.
    expect(HOUSE_STYLE.replace(/\([—–]\) or en dashes \([—–]\)/g, '')).not.toMatch(/[—–]/);
  });
});
