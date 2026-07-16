import { describe, it, expect } from 'vitest';
import { matchPackagingText, findPackagingSizeMl } from '@/lib/products/match-packaging-text';

describe('findPackagingSizeMl', () => {
  it('reads a plain ml size', () => {
    expect(findPackagingSizeMl('330ml amber glass bottle')).toBe(330);
    expect(findPackagingSizeMl('500 ml can')).toBe(500);
  });

  it('converts litres to ml', () => {
    expect(findPackagingSizeMl('30 litre keg')).toBe(30000);
    expect(findPackagingSizeMl('1l bottle')).toBe(1000);
  });

  it('returns null when no size is stated', () => {
    expect(findPackagingSizeMl('glass bottle')).toBeNull();
  });
});

describe('matchPackagingText', () => {
  it('matches a glass bottle with size', () => {
    const match = matchPackagingText('330ml amber glass bottle');
    expect(match).not.toBeNull();
    expect(match?.format.key).toBe('bottle');
    expect(match?.material.key).toBe('glass');
    expect(match?.sizeMl).toBe(330);
    expect(match?.typicalWeight).not.toBeNull();
  });

  it('matches an aluminium can', () => {
    const match = matchPackagingText('440ml aluminium can');
    expect(match?.format.key).toBe('can');
    expect(match?.material.key).toBe('aluminium');
    expect(match?.sizeMl).toBe(440);
  });

  it('matches a stainless steel keg with litres', () => {
    const match = matchPackagingText('30 litre stainless steel keg');
    expect(match?.format.key).toBe('keg');
    expect(match?.material.key).toBe('steel');
    expect(match?.sizeMl).toBe(30000);
  });

  it('falls back to a product size when text has none', () => {
    const match = matchPackagingText('glass bottle', 750);
    expect(match?.sizeMl).toBe(750);
  });

  it('defaults material to the format\'s first material when none is named', () => {
    const match = matchPackagingText('bottle', 750);
    expect(match?.format.key).toBe('bottle');
    expect(match?.material.key).toBe('glass');
  });

  it('returns null for text with no recognised format', () => {
    expect(matchPackagingText('a custom widget')).toBeNull();
    expect(matchPackagingText('')).toBeNull();
  });
});
