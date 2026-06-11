/**
 * Curated plain-language display names for emission-factor processes.
 *
 * Users are not LCA practitioners: "market for packaging glass, white {RER}|
 * Cutoff, U" reads as noise and erodes confidence. The search route already
 * derives friendly names by reverse-matching the drinks aliases; this map
 * covers the common drinks-relevant processes those aliases miss. The
 * technical name is never lost — the UI shows it beneath the friendly title
 * and in the info popover for traceability.
 *
 * Patterns are matched case-insensitively with `includes`, FIRST match wins,
 * so list more specific patterns before generic ones.
 */

const FRIENDLY_NAME_PATTERNS: Array<[pattern: string, friendly: string]> = [
  // ── Packaging materials ────────────────────────────────────────────────
  ['packaging glass production', 'Glass (container grade)'],
  ['market for packaging glass', 'Glass (container grade)'],
  ['glass bottle production', 'Glass bottle'],
  ['carton board box production', 'Cardboard box (flat carton board)'],
  ['corrugated board box', 'Cardboard box (corrugated)'],
  ['folding boxboard', 'Folding carton board'],
  ['beverage carton converting', 'Beverage carton (Tetra Pak style)'],
  ['market for beverage carton', 'Beverage carton (Tetra Pak style)'],
  ['polyethylene terephthalate', 'PET plastic'],
  ['stretch blow moulding', 'PET bottle forming'],
  ['polyethylene, high density', 'HDPE plastic'],
  ['polyethylene, low density', 'LDPE plastic (films and wraps)'],
  ['polypropylene', 'Polypropylene plastic (PP)'],
  ['aluminium, wrought alloy', 'Aluminium (sheet)'],
  ['sheet rolling, aluminium', 'Aluminium (rolled sheet)'],
  ['aluminium, primary, ingot', 'Aluminium (primary)'],
  ['aluminium collector foil', 'Aluminium foil'],
  ['used beverage can', 'Aluminium can (recycled route)'],
  ['cork slab', 'Cork'],
  ['cork stopper', 'Cork stopper'],
  ['tinplate', 'Tinplate steel'],
  ['chromium steel 18/8', 'Stainless steel'],
  ['kraft paper', 'Kraft paper'],
  ['market for packaging paper', 'Packaging paper'],
  ['paper production', 'Paper'],
  ['eur-flat pallet', 'Wooden pallet (EUR)'],
  ['printing ink', 'Printing ink'],

  // ── Common drinks ingredients ──────────────────────────────────────────
  ['malt production', 'Malted barley'],
  ['barley grain', 'Barley'],
  ['wheat grain', 'Wheat'],
  ['maize grain', 'Maize (corn)'],
  ['rye grain', 'Rye'],
  ['oat grain', 'Oats'],
  ['rice production', 'Rice'],
  ['hop production', 'Hops'],
  ['grape production', 'Grapes'],
  ['apple production', 'Apples'],
  ['pear production', 'Pears'],
  ['orange production', 'Oranges'],
  ['lemon production', 'Lemons'],
  ['sugar production', 'Sugar'],
  ['sugar, from sugarcane', 'Cane sugar'],
  ['sugar, from sugar beet', 'Beet sugar'],
  ['sugar beet production', 'Sugar beet'],
  ['sugarcane production', 'Sugar cane'],
  ['molasses', 'Molasses'],
  ['glucose syrup', 'Glucose syrup'],
  ['honey production', 'Honey'],
  ['citric acid', 'Citric acid'],
  ['carbon dioxide production', 'Carbon dioxide (CO2)'],
  ['market for carbon dioxide', 'Carbon dioxide (CO2)'],
  ['yeast production', 'Yeast'],
  ['fodder yeast', 'Yeast'],
  ['milk production', 'Milk'],
  ['cream production', 'Cream'],
  ['tap water', 'Tap water'],
  ['water, ultrapure', 'Purified water'],
  ['ethanol production from', 'Ethanol (neutral spirit)'],
  ['market for ethanol', 'Ethanol (neutral spirit)'],
  ['vanilla production', 'Vanilla'],
  ['ginger production', 'Ginger'],
  ['coffee, green bean', 'Coffee beans'],
  ['cocoa bean', 'Cocoa beans'],
  ['tea production', 'Tea'],
];

/**
 * Return a plain-language name for a technical process name, or null when
 * no curated pattern applies (callers keep their existing behaviour).
 */
export function friendlyNameFor(processName: string | null | undefined): string | null {
  if (!processName) return null;
  const lower = processName.toLowerCase();
  for (const [pattern, friendly] of FRIENDLY_NAME_PATTERNS) {
    if (lower.includes(pattern)) return friendly;
  }
  return null;
}
