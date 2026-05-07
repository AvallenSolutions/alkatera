import { describe, it, expect } from 'vitest';
import {
  lookupTerm,
  extractTerms,
  translateBoundary,
  GLOSSARY,
  ALL_GLOSSARY_ENTRIES,
} from '../lca-glossary';

describe('lookupTerm', () => {
  it('finds canonical terms case-insensitively', () => {
    expect(lookupTerm('GLO')?.label).toBe('GLO');
    expect(lookupTerm('glo')?.label).toBe('GLO');
    expect(lookupTerm('Cut-Off')?.label).toBe('cut-off');
  });

  it('strips curly braces from region codes', () => {
    expect(lookupTerm('{GLO}')?.term).toBe('glo');
    expect(lookupTerm('{GB}')?.term).toBe('gb');
  });

  it('returns null for unknown terms', () => {
    expect(lookupTerm('blarg')).toBeNull();
    expect(lookupTerm('')).toBeNull();
  });
});

describe('extractTerms', () => {
  it('finds short region codes only on word boundaries', () => {
    // "global" should NOT match "gb"
    const terms = extractTerms('global average');
    expect(terms.find((t) => t.term === 'gb')).toBeUndefined();
  });

  it('finds GLO inside curly braces', () => {
    const terms = extractTerms('Barley grain {GLO}');
    expect(terms.find((t) => t.term === 'glo')).toBeDefined();
  });

  it('finds multi-word terms', () => {
    const terms = extractTerms('The market for barley grain');
    expect(terms.find((t) => t.term === 'market for')).toBeDefined();
  });

  it('returns each term once even with multiple occurrences', () => {
    const terms = extractTerms('GLO factor for {GLO} barley');
    expect(terms.filter((t) => t.term === 'glo').length).toBe(1);
  });

  it('finds cut-off and APOS', () => {
    const terms = extractTerms('Allocation, cut-off by classification');
    expect(terms.find((t) => t.term === 'cut-off')).toBeDefined();
    expect(terms.find((t) => t.term === 'allocation')).toBeDefined();
  });
});

describe('translateBoundary', () => {
  it('matches canonical cradle-to-gate', () => {
    const t = translateBoundary('cradle-to-gate');
    expect(t).not.toBeNull();
    expect(t!.headline).toBe('Cradle-to-Gate');
    expect(t!.included).toContain('Raw Materials');
    expect(t!.included).toContain('Processing');
    expect(t!.excluded).toContain('Distribution');
    expect(t!.excluded).toContain('End of Life');
  });

  it('preserves free-text suffix verbatim', () => {
    const t = translateBoundary('Cradle-to-gate: field cultivation through drying');
    expect(t!.headline).toBe('Cradle-to-Gate');
    expect(t!.suffix).toBe('field cultivation through drying');
  });

  it('matches cradle-to-grave', () => {
    const t = translateBoundary('cradle-to-grave');
    expect(t!.headline).toBe('Cradle-to-Grave');
    expect(t!.included).toContain('End of Life');
    expect(t!.excluded).toEqual([]);
  });

  it('returns null for empty input', () => {
    expect(translateBoundary(undefined)).toBeNull();
    expect(translateBoundary(null)).toBeNull();
    expect(translateBoundary('')).toBeNull();
  });

  it('falls back to raw text when no canonical match', () => {
    const t = translateBoundary('Unknown boundary description');
    expect(t).not.toBeNull();
    expect(t!.summary).toBe('Unknown boundary description');
    expect(t!.included).toEqual([]);
  });
});

describe('GLOSSARY data integrity', () => {
  it('has unique keys for every entry', () => {
    const keys = ALL_GLOSSARY_ENTRIES.map((e) => e.term);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has plain-English text for every entry', () => {
    for (const entry of ALL_GLOSSARY_ENTRIES) {
      expect(entry.plainEnglish.length).toBeGreaterThan(10);
    }
  });

  it('object form matches array form', () => {
    expect(Object.keys(GLOSSARY).length).toBe(ALL_GLOSSARY_ENTRIES.length);
  });
});
