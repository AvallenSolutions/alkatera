/**
 * Filename-signature keying for the Smart Upload learning loop.
 *
 * Spreadsheets rarely carry a supplier name the classifier can extract, so
 * type corrections are remembered against a normalised filename pattern
 * instead: recurring documents from the same source tend to share a naming
 * scheme where only dates/versions/batch numbers change, and those digit runs
 * collapse to '#'.
 *
 * Example: "BEV_ECM_TobyCo_Recipe_2025_v3.xlsx" → "bev ecm tobyco recipe # v#"
 *
 * Zero imports — bundle-safe for the Netlify background function graph.
 */

const MAX_TOKENS = 6;
const MAX_CHARS = 80;

// Generic tokens that carry no source identity on their own.
const JUNK_TOKENS = new Set([
  'scan',
  'scanned',
  'img',
  'image',
  'photo',
  'doc',
  'document',
  'file',
  'copy',
  'final',
  'new',
  'untitled',
  'upload',
  'download',
  'attachment',
  'pdf',
  'xlsx',
  'xls',
  'csv',
]);

/**
 * Stable filename-token key. Returns null when the name is too generic to
 * identify a document source (e.g. "scan_20260714.jpg", "IMG_0042").
 */
export function docSignature(fileName: string): string | null {
  if (!fileName || typeof fileName !== 'string') return null;

  const withoutExt = fileName.replace(/\.[A-Za-z0-9]{1,5}$/, '');
  const tokens = withoutExt
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/\d+(?:st|nd|rd|th)?/g, '#') // digit runs (incl. ordinals: 17th, 3rd) → placeholder
    .replace(/[^a-z#]+/g, ' ') // everything else → token boundaries
    .trim()
    .split(/\s+/)
    .filter((t) => t !== '')
    .slice(0, MAX_TOKENS);

  // Meaningful = alphabetic tokens that are not generic junk. '#' tokens and
  // junk words keep their place in the signature but cannot carry it alone.
  const meaningfulChars = tokens
    .filter((t) => !JUNK_TOKENS.has(t))
    .join('')
    .replace(/#/g, '');
  if (meaningfulChars.length < 4) return null;

  return tokens.join(' ').slice(0, MAX_CHARS);
}
