import { randomBytes } from 'node:crypto';

/** url-safe-ish slug from a brand name, for a readable token prefix. */
export function slugifyBrand(brandName: string): string {
  return (
    brandName
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'brand'
  );
}

/**
 * Generate an unguessable capability token for a report URL, prefixed with a
 * readable brand slug, e.g. "avallen-7f3a9c2e8b1d4655". The 16-hex-char random
 * suffix (64 bits) is the security boundary; the slug is cosmetic.
 */
export function generateReportToken(brandName: string): string {
  const random = randomBytes(8).toString('hex'); // 16 hex chars, 64 bits
  return `${slugifyBrand(brandName)}-${random}`;
}
