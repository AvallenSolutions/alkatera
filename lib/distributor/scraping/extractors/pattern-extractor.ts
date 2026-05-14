import type { FieldKey } from '../field-definitions';

/**
 * Fast pattern-based pass over page text. Catches the easy hits before
 * we spend money on the LLM — e.g. mentions of "B Corp" in the page body
 * or a 4-digit "founded in YYYY" string. Anything found here is
 * reported as `extraction_method='pattern_match'` with a lower
 * confidence than a structured DOM parse.
 */
export interface PatternResult {
  values: Partial<Record<FieldKey, unknown>>;
}

export function extractPatterns(text: string): PatternResult {
  const values: PatternResult['values'] = {};
  const lower = text.toLowerCase();

  // B Corp signal variants. We're permissive on purpose — brands use
  // wildly different phrasing ("Certified B Corporation", "B Corp™",
  // "B-Corp", "we are a B Corp"). We do filter out PENDING/aspirational
  // mentions so a "working towards B Corp" page doesn't get marked
  // certified.
  if (looksBCorpCertified(text)) {
    values.bcorp_certified = true;
  }
  if (/\bcarbon\s+trust\s+(certifi|standard)/i.test(text)) {
    values.carbon_trust_certified = true;
  }
  if (/\biso\s*14001\b/i.test(text)) values.iso_14001_certified = true;
  if (/\biso\s*50001\b/i.test(text)) values.iso_50001_certified = true;
  if (/\bfairtrade\s+certifi/i.test(text)) values.fairtrade_certified = true;
  if (/\brainforest\s+alliance\b/i.test(text)) values.rainforest_alliance_certified = true;
  if (/\b(certified\s+organic|organic\s+certifi)/i.test(text)) values.organic_certified = true;

  // "founded in 1923" / "established 1810" / "since 1810"
  const foundedMatch = text.match(/\b(?:founded|established|since)\s+(?:in\s+)?(1[789]\d{2}|20\d{2})\b/i);
  if (foundedMatch) {
    values.founding_year = parseInt(foundedMatch[1], 10);
  }

  // "net zero by 2030" / "carbon neutral by 2040"
  const netZeroMatch = text.match(/\b(?:net\s*zero|carbon\s*neutral)\s+by\s+(20\d{2})\b/i);
  if (netZeroMatch) {
    values.net_zero_target_year = parseInt(netZeroMatch[1], 10);
  }

  if (lower.includes('science-based target') || lower.includes('science based target') || lower.includes('sbti')) {
    if (lower.includes('committed') || lower.includes('commitment')) {
      values.sbt_status = 'committed';
    } else if (lower.includes('approved') || lower.includes('validated') || lower.includes('targets set')) {
      values.sbt_status = 'targets_set';
    }
  }

  // "85% recycled" / "100% recycled content"
  const recycledMatch = text.match(/(\d{1,3})\s*%\s+recycled/i);
  if (recycledMatch) {
    const pct = parseInt(recycledMatch[1], 10);
    if (pct >= 0 && pct <= 100) values.recycled_packaging_percentage = pct;
  }

  return { values };
}

/**
 * Returns true if the text contains a credible "this brand is a
 * Certified B Corp" statement. Permissive on phrasing variants:
 *
 *   - "Certified B Corp", "Certified B Corporation", "Certified B Corp™"
 *   - "B Corp Certified", "B-Corp Certified", "BCorp certified"
 *   - "We are a B Corp", "proudly B Corp", "Now a B Corp"
 *   - "B Corp™" with no qualifier (logo + mark — very common in footers)
 *
 * Rejects aspirational language:
 *   - "Pending B Corp certification", "Working towards B Corp",
 *     "B Corp pending", "applying to become a B Corp"
 *
 * The pending check runs against a window around the match so a page
 * that says "we are a Certified B Corp" elsewhere isn't dismissed just
 * because a footer link mentions another brand's pending application.
 */
export function looksBCorpCertified(text: string): boolean {
  const lower = text.toLowerCase();

  // Strong positive signals (long phrases beat short ones).
  const positiveRegexes: RegExp[] = [
    /\bcertified\s+b[\s-]?corp(?:oration)?\b/i,
    /\bb[\s-]?corp(?:oration)?\s+certifi(?:ed|cation)/i,
    /\b(?:proudly|now|we'?re|we\s+are)\s+(?:a\s+)?(?:certified\s+)?b[\s-]?corp\b/i,
    /\bb[\s-]?corp\s*™/i, // "B Corp™" mark — used as a stand-alone footer badge
  ];

  let earliestMatchIndex = -1;
  for (const re of positiveRegexes) {
    const m = text.match(re);
    if (m && m.index !== undefined) {
      if (earliestMatchIndex < 0 || m.index < earliestMatchIndex) {
        earliestMatchIndex = m.index;
      }
    }
  }
  if (earliestMatchIndex < 0) return false;

  // Look for pending/aspirational language within 120 chars of the
  // match — if present, this is likely not a real certification claim.
  const start = Math.max(0, earliestMatchIndex - 120);
  const end = Math.min(text.length, earliestMatchIndex + 120);
  const window = lower.slice(start, end);
  const negativePatterns = [
    'pending',
    'working towards',
    'working to become',
    'applying to become',
    'in the process of',
    'aspiring to be',
    'aim to be',
    'soon to be',
    'on our way to',
  ];
  for (const phrase of negativePatterns) {
    if (window.includes(phrase)) return false;
  }
  return true;
}
