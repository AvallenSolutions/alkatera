import { describe, expect, it } from 'vitest';
import {
  NO_VALUE,
  clampPctWidth,
  isFiniteNumber,
  safeDateTime,
  safeFixed,
  safeNum,
  safePct,
} from '../format';

describe('pulse/format -- finite-safe formatters (the "pulse NaN" guard)', () => {
  describe('isFiniteNumber', () => {
    it('accepts only real finite numbers', () => {
      expect(isFiniteNumber(0)).toBe(true);
      expect(isFiniteNumber(-3.2)).toBe(true);
    });
    it('rejects NaN, Infinity, null, undefined and non-numbers', () => {
      expect(isFiniteNumber(Number.NaN)).toBe(false);
      expect(isFiniteNumber(Number.POSITIVE_INFINITY)).toBe(false);
      expect(isFiniteNumber(Number.NEGATIVE_INFINITY)).toBe(false);
      expect(isFiniteNumber(null)).toBe(false);
      expect(isFiniteNumber(undefined)).toBe(false);
      expect(isFiniteNumber('5')).toBe(false);
    });
  });

  describe('safeFixed', () => {
    it('formats finite numbers', () => {
      expect(safeFixed(3.14159, 2)).toBe('3.14');
      expect(safeFixed(10)).toBe('10');
    });
    it('falls back for non-finite input', () => {
      expect(safeFixed(Number.NaN, 1)).toBe(NO_VALUE);
      expect(safeFixed(Number.POSITIVE_INFINITY)).toBe(NO_VALUE);
      expect(safeFixed(null)).toBe(NO_VALUE);
      expect(safeFixed(undefined, 0, 'n/a')).toBe('n/a');
    });
  });

  describe('safePct', () => {
    it('formats and respects the sign option', () => {
      expect(safePct(12.3, 0)).toBe('12%');
      expect(safePct(12.3, 1, { sign: true })).toBe('+12.3%');
      expect(safePct(-4, 0, { sign: true })).toBe('-4%');
    });
    it('falls back for non-finite input', () => {
      expect(safePct(Number.NaN)).toBe(NO_VALUE);
      expect(safePct(Number.POSITIVE_INFINITY, 0, { sign: true })).toBe(NO_VALUE);
      expect(safePct(null, 0, { fallback: '0%' })).toBe('0%');
    });
  });

  describe('safeNum', () => {
    it('formats finite numbers with en-GB grouping', () => {
      expect(safeNum(1234567)).toBe('1,234,567');
      expect(safeNum(1.25, { maximumFractionDigits: 1 })).toBe('1.3');
    });
    it('falls back for non-finite input', () => {
      expect(safeNum(Number.NaN)).toBe(NO_VALUE);
      expect(safeNum(undefined)).toBe(NO_VALUE);
    });
  });

  describe('safeDateTime', () => {
    it('formats a valid ISO string', () => {
      // Just assert it does not return the fallback and contains the year.
      const out = safeDateTime('2026-06-15T09:00:00.000Z');
      expect(out).not.toBe(NO_VALUE);
      expect(out).toContain('2026');
    });
    it('falls back for null, empty and unparseable input', () => {
      expect(safeDateTime(null)).toBe(NO_VALUE);
      expect(safeDateTime('')).toBe(NO_VALUE);
      expect(safeDateTime('not-a-date')).toBe(NO_VALUE);
      expect(safeDateTime(undefined, 'n/a')).toBe('n/a');
    });
  });

  describe('clampPctWidth', () => {
    it('passes through values in range', () => {
      expect(clampPctWidth(42)).toBe(42);
      expect(clampPctWidth(0)).toBe(0);
      expect(clampPctWidth(100)).toBe(100);
    });
    it('clamps out-of-range and collapses non-finite to 0', () => {
      expect(clampPctWidth(140)).toBe(100);
      expect(clampPctWidth(-5)).toBe(0);
      expect(clampPctWidth(Number.NaN)).toBe(0);
      // Infinity (e.g. from a divide-by-zero) is non-finite, so it collapses to 0.
      expect(clampPctWidth(Number.POSITIVE_INFINITY)).toBe(0);
      expect(clampPctWidth(null)).toBe(0);
    });
  });
});
