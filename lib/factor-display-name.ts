/**
 * Helpers for displaying emission-factor names to non-LCA users.
 *
 * Agribalyse / ecoinvent process names carry trailing provenance suffixes
 * like "- Copied from Ecoinvent U" or "- Adapted from WFLDB" that are
 * audit-relevant but visually noisy. We strip them when displaying the name
 * in result rows and hover previews; the full canonical name is preserved
 * in the click popover for traceability.
 */

const PROVENANCE_SUFFIX_RE =
  /\s*-\s*(Copied|Adapted|Derived)\s+from\s+(Ecoinvent|WFLDB|Agri-footprint|Agrifootprint)(\s+[US])?\s*\.?\s*$/i;

/**
 * Strip the trailing provenance suffix from a factor name. Idempotent.
 *
 *   "Barley grain {GLO}| market for | Cut-off, S - Copied from Ecoinvent U"
 *     → "Barley grain {GLO}| market for | Cut-off, S"
 *
 *   "Barley grain {FR}| barley production | Cut-off, U - Adapted from Ecoinvent U"
 *     → "Barley grain {FR}| barley production | Cut-off, U"
 *
 *   "Hops, T-90 pellets" (no suffix) → unchanged
 */
export function cleanFactorDisplayName(
  name: string | null | undefined,
): string {
  if (!name) return '';
  return name.replace(PROVENANCE_SUFFIX_RE, '').trim();
}
