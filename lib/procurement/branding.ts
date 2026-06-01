import type { ProcurementBranding } from '@/types/procurement';

/**
 * Convert a #RRGGBB hex colour to an "R G B" triplet for use in a CSS
 * variable like `--brand-primary-rgb: 12 81 64;`. Returns null when the
 * input is not a parseable hex; the caller falls back to the default
 * sky-400 / sky-500 palette.
 */
export function hexToRgbTriple(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const clean = hex.trim().replace(/^#/, '');
  const expanded = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  if (expanded.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(expanded)) return null;
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/**
 * Pick a readable foreground (text) colour for a given brand fill. Uses
 * the WCAG relative-luminance formula. Returns "0 0 0" (black) for light
 * fills, "255 255 255" (white) for dark fills.
 */
export function pickOnColor(rgbTriple: string | null): string {
  if (!rgbTriple) return '0 0 0';
  const parts = rgbTriple.split(/\s+/).map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return '0 0 0';
  const [r, g, b] = parts.map((c) => {
    const sr = c / 255;
    return sr <= 0.03928 ? sr / 12.92 : Math.pow((sr + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? '0 0 0' : '255 255 255';
}

/**
 * Build the contents of an inline <style> block that injects the tenant
 * brand colours into the CSS variable layer used by the procurement and
 * (themed) distributor portals.
 *
 * Null / unset values fall back to the sky-400 / sky-500 defaults
 * declared in app/globals.css.
 */
export function brandThemeCss(branding: ProcurementBranding): string {
  const primary = hexToRgbTriple(branding.primary_color);
  const accent = hexToRgbTriple(branding.accent_color);
  if (!primary && !accent) return '';

  const onPrimary = primary ? pickOnColor(primary) : null;

  const lines: string[] = [];
  if (primary) lines.push(`  --brand-primary-rgb: ${primary};`);
  if (accent) lines.push(`  --brand-accent-rgb: ${accent};`);
  if (onPrimary) lines.push(`  --brand-on-primary-rgb: ${onPrimary};`);

  return `:root {\n${lines.join('\n')}\n}`;
}
