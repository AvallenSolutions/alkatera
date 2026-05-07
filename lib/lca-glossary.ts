/**
 * LCA Glossary
 *
 * A standardised, deterministic translator for the technical terms users
 * encounter when picking emission factors (ecoinvent, Agribalyse, DEFRA).
 * Used by:
 *  - EmissionFactorDetailPopover (inline `?`-chips on jargon)
 *  - InlineIngredientSearch HoverCard preview
 *  - SearchGuidePanel "How to read a factor" section
 *
 * No AI calls — the source-database terminology is finite and stable.
 */

import {
  SYSTEM_BOUNDARIES,
  STAGE_LABELS,
  getBoundaryDefinition,
  getBoundaryIncludedStages,
  getBoundaryExcludedStages,
  type LifecycleStage,
} from './system-boundaries';

export interface GlossaryEntry {
  /** The canonical lookup key (lowercase). */
  term: string;
  /** Human-readable label shown to the user. */
  label: string;
  /** Single-sentence plain-English definition. */
  plainEnglish: string;
  /** Optional follow-up: when this matters in practice. */
  whenItMatters?: string;
  /** Category — used by the search guide to group entries. */
  group: 'geography' | 'methodology' | 'boundary' | 'measurement';
}

const ENTRIES: GlossaryEntry[] = [
  // ── Geography codes ────────────────────────────────────────────────────
  {
    term: 'glo',
    label: 'GLO',
    plainEnglish: 'Global average. The factor blends data from many countries into a single worldwide value.',
    whenItMatters: 'Safe fallback when no regional match exists, but it can hide big country-by-country differences.',
    group: 'geography',
  },
  {
    term: 'row',
    label: 'RoW',
    plainEnglish: 'Rest of World. Everywhere except the regions that have their own dedicated factor.',
    whenItMatters: 'Use when your supply chain is outside Europe and there is no country-specific factor.',
    group: 'geography',
  },
  {
    term: 'rer',
    label: 'RER',
    plainEnglish: 'Europe (excluding a few smaller countries). A regional average for European production.',
    group: 'geography',
  },
  {
    term: 'europe without switzerland',
    label: 'Europe without Switzerland',
    plainEnglish: 'European average that explicitly excludes Switzerland (a common ecoinvent regional split).',
    group: 'geography',
  },
  {
    term: 'gb',
    label: 'GB',
    plainEnglish: 'Great Britain. Use when your supplier is in England, Scotland or Wales.',
    group: 'geography',
  },
  {
    term: 'fr',
    label: 'FR',
    plainEnglish: 'France. Often the best fit for European agricultural ingredients via Agribalyse.',
    group: 'geography',
  },
  {
    term: 'us',
    label: 'US',
    plainEnglish: 'United States.',
    group: 'geography',
  },
  {
    term: 'cn',
    label: 'CN',
    plainEnglish: 'China. Use when sourcing from a Chinese supplier.',
    group: 'geography',
  },
  {
    term: 'de',
    label: 'DE',
    plainEnglish: 'Germany. Use when sourcing from a German supplier.',
    group: 'geography',
  },
  {
    term: 'es',
    label: 'ES',
    plainEnglish: 'Spain. Use when sourcing from a Spanish supplier.',
    group: 'geography',
  },

  // ── System models / methodology ────────────────────────────────────────
  {
    term: 'cut-off',
    label: 'cut-off',
    plainEnglish: 'An accounting approach where recycled materials enter your product carbon-free; the upstream waste burden stays with the original producer.',
    whenItMatters: 'Most common in ecoinvent. Favours products that use recycled inputs.',
    group: 'methodology',
  },
  {
    term: 'apos',
    label: 'APOS',
    plainEnglish: 'Allocation at the Point of Substitution. Splits shared emissions between co-products by economic value.',
    whenItMatters: 'You will see this on multi-output processes like dairy or refineries.',
    group: 'methodology',
  },
  {
    term: 'consequential',
    label: 'consequential',
    plainEnglish: 'Models the knock-on effects of a decision (e.g. extra demand changing what gets produced) rather than reporting average emissions.',
    whenItMatters: 'Useful for "what if" scenarios; less useful for routine product footprinting.',
    group: 'methodology',
  },
  {
    term: 'allocation',
    label: 'allocation',
    plainEnglish: 'How shared emissions from a process are divided between its co-products (e.g. mass, energy or economic value).',
    group: 'methodology',
  },
  {
    term: 'market for',
    label: 'market for',
    plainEnglish: 'The factor includes typical mixing of suppliers and average transport to the buyer for that region.',
    whenItMatters: 'Pick "market for" when you do not know your specific producer; pick "production" when you do.',
    group: 'methodology',
  },
  {
    term: 'production',
    label: 'production',
    plainEnglish: 'The factor covers a single production route, without any transport or supplier mixing.',
    whenItMatters: 'Use this when you know your specific producer and will model transport yourself.',
    group: 'methodology',
  },
  {
    term: 'at farm',
    label: 'at farm',
    plainEnglish: 'Coverage stops at the farm gate — before any packing, processing or onward transport.',
    group: 'methodology',
  },
  {
    term: 'at plant',
    label: 'at plant',
    plainEnglish: 'Coverage stops at the factory or processing plant gate.',
    group: 'methodology',
  },

  // ── Boundaries (delegated to system-boundaries.ts) ─────────────────────
  {
    term: 'cradle-to-gate',
    label: 'Cradle-to-Gate',
    plainEnglish: 'Everything from raw materials through to leaving the factory. Excludes shipping to your facility, the use phase, and end-of-life.',
    group: 'boundary',
  },
  {
    term: 'cradle-to-shelf',
    label: 'Cradle-to-Shelf',
    plainEnglish: 'Cradle-to-Gate plus distribution to the point of sale.',
    group: 'boundary',
  },
  {
    term: 'cradle-to-consumer',
    label: 'Cradle-to-Consumer',
    plainEnglish: 'Cradle-to-Shelf plus the consumer use phase (chilling, mixing, etc.).',
    group: 'boundary',
  },
  {
    term: 'cradle-to-grave',
    label: 'Cradle-to-Grave',
    plainEnglish: 'Full lifecycle including end-of-life disposal and recycling.',
    group: 'boundary',
  },

  // ── Measurement / quality ──────────────────────────────────────────────
  {
    term: 'lcia',
    label: 'LCIA',
    plainEnglish: 'Life Cycle Impact Assessment — the methodology used to convert emissions into impact scores like CO₂e.',
    group: 'measurement',
  },
  {
    term: 'gwp100',
    label: 'GWP100',
    plainEnglish: 'Global Warming Potential over 100 years. The standard timeframe used to compare different greenhouse gases.',
    group: 'measurement',
  },
  {
    term: 'co2e',
    label: 'CO₂e',
    plainEnglish: 'Carbon dioxide equivalent. A single number that bundles all greenhouse gases (methane, N₂O, etc.) into the warming impact of CO₂.',
    group: 'measurement',
  },
  {
    term: 'biogenic',
    label: 'biogenic',
    plainEnglish: 'Carbon that came from recently living plants or animals (not from fossil fuels). Often reported separately.',
    group: 'measurement',
  },
  {
    term: 'fossil',
    label: 'fossil',
    plainEnglish: 'Carbon released from fossil fuels (coal, oil, gas). This is the climate impact you want to reduce.',
    group: 'measurement',
  },
  {
    term: 'uncertainty',
    label: 'uncertainty',
    plainEnglish: 'A ± range showing how much the real emissions could differ from the stated number. Lower uncertainty = more confident data.',
    group: 'measurement',
  },
  {
    term: 'data quality grade',
    label: 'data quality grade',
    plainEnglish: 'A HIGH/MEDIUM/LOW score reflecting how well the factor matches your specific product, region and time period.',
    group: 'measurement',
  },
  {
    term: 'system boundary',
    label: 'system boundary',
    plainEnglish: 'Which lifecycle stages the factor includes — e.g. just farming, or also processing, transport, use and disposal.',
    group: 'measurement',
  },
  {
    term: 'temporal coverage',
    label: 'temporal coverage',
    plainEnglish: 'The time period the underlying data was collected for. Older data may not reflect today’s production methods.',
    group: 'measurement',
  },
];

/**
 * Glossary keyed by lowercase term, for O(1) lookups.
 */
export const GLOSSARY: Record<string, GlossaryEntry> = Object.fromEntries(
  ENTRIES.map((e) => [e.term, e]),
);

/**
 * Direct lookup. Case- and trim-insensitive. Strips surrounding curly braces.
 */
export function lookupTerm(text: string): GlossaryEntry | null {
  if (!text) return null;
  const key = text.trim().toLowerCase().replace(/[{}]/g, '');
  return GLOSSARY[key] ?? null;
}

/**
 * Find every glossary term that appears anywhere in a free-text string.
 * Returns each entry at most once, in the order it first appears.
 */
export function extractTerms(text: string): GlossaryEntry[] {
  if (!text) return [];
  const haystack = text.toLowerCase();
  const seen = new Set<string>();
  const matches: Array<{ entry: GlossaryEntry; index: number }> = [];

  for (const entry of ENTRIES) {
    if (seen.has(entry.term)) continue;
    // Word-boundary-ish match for short codes; substring for multi-word.
    const needle = entry.term;
    let idx = -1;
    if (needle.length <= 3) {
      // For 2-3 letter codes (GB, RoW, GLO), require a non-letter boundary so
      // we don't match the inside of a word.
      const re = new RegExp(`(^|[^a-z])${needle}([^a-z]|$)`, 'i');
      const m = haystack.match(re);
      if (m && m.index != null) idx = m.index + (m[1] ? m[1].length : 0);
    } else {
      idx = haystack.indexOf(needle);
    }
    if (idx >= 0) {
      seen.add(entry.term);
      matches.push({ entry, index: idx });
    }
  }
  return matches.sort((a, b) => a.index - b.index).map((m) => m.entry);
}

/**
 * Translate a (possibly free-text) `system_boundary` value into a structured
 * plain-English explanation.
 *
 * Tier 1 (deterministic): Match the canonical boundaries from
 *   `lib/system-boundaries.ts` via prefix/keyword detection.
 * Tier 2 (passthrough): Append the free-text suffix verbatim so DB nuance
 *   (e.g. "...field cultivation through drying") is preserved.
 *
 * If no match is found at all, returns null so the caller can choose to
 * either fall back to a generic message or hide the section.
 */
export interface BoundaryTranslation {
  /** Canonical boundary label, e.g. "Cradle-to-Gate". */
  headline: string;
  /** One-sentence plain-English description of what the boundary covers. */
  summary: string;
  /** Lifecycle stages included in the boundary, as user-friendly labels. */
  included: string[];
  /** Lifecycle stages excluded from the boundary, as user-friendly labels. */
  excluded: string[];
  /** Free-text suffix from the DB if it added detail beyond the canonical name. */
  suffix?: string;
}

const STAGES_AS_LABELS = (stages: LifecycleStage[]) =>
  stages.map((s) => STAGE_LABELS[s]);

const BOUNDARY_SUMMARIES: Record<string, string> = {
  'cradle-to-gate':
    'Everything from raw materials through to leaving the factory. Does not include shipping to you, packaging your finished drink, the use phase, or end-of-life.',
  'cradle-to-shelf':
    'Cradle-to-Gate plus distribution from the factory to the point of sale. Does not include the consumer use phase or end-of-life.',
  'cradle-to-consumer':
    'Cradle-to-Shelf plus the consumer use phase (chilling, mixing, etc.). Does not include end-of-life.',
  'cradle-to-grave':
    'The full lifecycle, from raw materials all the way through end-of-life disposal and recycling.',
};

export function translateBoundary(
  systemBoundary: string | null | undefined,
): BoundaryTranslation | null {
  if (!systemBoundary || typeof systemBoundary !== 'string') return null;

  const raw = systemBoundary.trim();
  const lower = raw.toLowerCase();

  // Tier 1: canonical match
  for (const def of SYSTEM_BOUNDARIES) {
    if (lower.startsWith(def.value) || lower.includes(def.label.toLowerCase())) {
      const stages = getBoundaryIncludedStages(def.value);
      const exclStages = getBoundaryExcludedStages(def.value);

      // Tier 2: capture any free-text after the canonical label
      // e.g. "Cradle-to-gate: field cultivation through drying" → "field cultivation through drying"
      const colonIdx = raw.indexOf(':');
      const suffixRaw = colonIdx >= 0 ? raw.slice(colonIdx + 1).trim() : '';

      return {
        headline: def.label,
        summary: BOUNDARY_SUMMARIES[def.value] ?? def.description,
        included: STAGES_AS_LABELS(stages),
        excluded: STAGES_AS_LABELS(exclStages),
        suffix: suffixRaw || undefined,
      };
    }
  }

  // No canonical match — return the raw text as the summary so we don't
  // misrepresent it. Caller decides whether to render.
  return {
    headline: 'System boundary',
    summary: raw,
    included: [],
    excluded: [],
  };
}

/**
 * Sections of glossary terms grouped by category, for the search guide UI.
 */
export function getGlossaryByGroup() {
  const groups: Record<GlossaryEntry['group'], GlossaryEntry[]> = {
    geography: [],
    methodology: [],
    boundary: [],
    measurement: [],
  };
  for (const e of ENTRIES) groups[e.group].push(e);
  return groups;
}

export const ALL_GLOSSARY_ENTRIES = ENTRIES;
