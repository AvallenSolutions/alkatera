/**
 * Pulse -- finite-safe display formatters.
 *
 * The "pulse NaN" bug class: rendering a raw API field or a division result
 * straight into .toFixed() / .toLocaleString() / new Date() shows the user
 * "NaN", "Infinity" or "Invalid Date" whenever the upstream value is
 * non-finite or unparseable. These helpers centralise the guard so widgets
 * never have to remember it at every call site.
 *
 * Convention: a missing/non-finite value renders as NO_VALUE (an en-space
 * placeholder, not an em dash, per house style).
 */

export const NO_VALUE = '—'; // visual placeholder for "no value yet"

/** True only for real, finite numbers (rejects NaN, Infinity, null, undefined). */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Fixed-decimal string, or `fallback` when the value is non-finite. */
export function safeFixed(
  value: number | null | undefined,
  digits = 0,
  fallback: string = NO_VALUE,
): string {
  return isFiniteNumber(value) ? value.toFixed(digits) : fallback;
}

/**
 * Percentage string with an optional explicit leading '+' on non-negatives.
 * Non-finite values render as `fallback`.
 */
export function safePct(
  value: number | null | undefined,
  digits = 0,
  opts?: { sign?: boolean; fallback?: string },
): string {
  const fallback = opts?.fallback ?? NO_VALUE;
  if (!isFiniteNumber(value)) return fallback;
  const sign = opts?.sign && value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

/** Locale number string (en-GB), or `fallback` when the value is non-finite. */
export function safeNum(
  value: number | null | undefined,
  numberOpts?: Intl.NumberFormatOptions,
  fallback: string = NO_VALUE,
): string {
  return isFiniteNumber(value)
    ? value.toLocaleString('en-GB', numberOpts)
    : fallback;
}

/** Locale date-time string (en-GB), or `fallback` for null/unparseable input. */
export function safeDateTime(
  value: string | number | Date | null | undefined,
  fallback: string = NO_VALUE,
): string {
  if (value === null || value === undefined || value === '') return fallback;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d.toLocaleString('en-GB');
}

/**
 * A bar width as a clamped [0, 100] percentage number, safe to drop straight
 * into a CSS `width: ${n}%`. Non-finite or negative inputs collapse to 0 so a
 * bar never overflows its track or vanishes into an invalid CSS value.
 */
export function clampPctWidth(value: number | null | undefined): number {
  if (!isFiniteNumber(value)) return 0;
  return Math.min(100, Math.max(0, value));
}
