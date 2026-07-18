/**
 * Report Theme System
 *
 * Each theme controls the visual style of a sustainability report PDF.
 * The same data flows through different themes to produce visually distinct reports.
 * Users pick a theme in the wizard; it's stored as `config.template`.
 */

export interface ReportTheme {
  id: string;
  name: string;
  description: string;

  // Typography
  headingFont: string;
  bodyFont: string;
  monoFont: string;
  headingWeight: string;          // '300' (light) | '700' (bold)
  headingSize: 'large' | 'medium' | 'compact';

  // Cover page
  coverBackground: 'dark' | 'light' | 'brand';
  coverStyle: 'hero-photo' | 'minimal' | 'brand-block' | 'editorial';

  // Page defaults
  pageBackground: string;
  pageDarkBackground: string;
  textColor: string;
  mutedTextColor: string;

  // Layout
  orientation: 'portrait' | 'landscape';
  sectionHeaderStyle: 'numbered' | 'divider-line' | 'bold-block';
  density: 'comfortable' | 'compact' | 'dense';

  // Content visibility
  showNarratives: boolean;
  showHeroImages: boolean;
  showLeadershipPage: boolean;
  showSectionDividers: boolean;
  chartStyle: 'donut' | 'bar' | 'minimal';

  // Page dimensions (computed from orientation)
  pageWidth: number;
  pageHeight: number;
  pagePadding: number;
}

// ============================================================================
// Built-in themes
// ============================================================================

const CLASSIC: ReportTheme = {
  id: 'classic',
  name: 'Annual',
  description: 'The full statement: poster cover, big honest numbers, quiet detail. Ideal for investors and stakeholders.',
  headingFont: "'Space Grotesk', sans-serif",
  bodyFont: "'Inter', sans-serif",
  monoFont: "'JetBrains Mono', monospace",
  headingWeight: '700',
  headingSize: 'large',
  coverBackground: 'brand',
  coverStyle: 'hero-photo',
  pageBackground: '#ECEAE3',
  pageDarkBackground: '#1A1B1D',
  textColor: '#1A1B1D',
  mutedTextColor: '#6F6F68',
  orientation: 'portrait',
  sectionHeaderStyle: 'numbered',
  density: 'comfortable',
  showNarratives: true,
  showHeroImages: true,
  showLeadershipPage: true,
  showSectionDividers: true,
  chartStyle: 'donut',
  pageWidth: 794,
  pageHeight: 1123,
  pagePadding: 48,
};

const MODERN: ReportTheme = {
  id: 'modern',
  name: 'Working',
  description: 'Quieter and denser: fewer poster moments, more facts per page. Great for customer-facing reports.',
  headingFont: "'Space Grotesk', sans-serif",
  bodyFont: "'Inter', sans-serif",
  monoFont: "'JetBrains Mono', monospace",
  headingWeight: '700',
  headingSize: 'medium',
  coverBackground: 'brand',
  coverStyle: 'minimal',
  pageBackground: '#ECEAE3',
  pageDarkBackground: '#1A1B1D',
  textColor: '#1A1B1D',
  mutedTextColor: '#6F6F68',
  orientation: 'portrait',
  sectionHeaderStyle: 'divider-line',
  density: 'comfortable',
  showNarratives: true,
  showHeroImages: true,
  showLeadershipPage: true,
  showSectionDividers: false,
  chartStyle: 'donut',
  pageWidth: 794,
  pageHeight: 1123,
  pagePadding: 48,
};

const EXECUTIVE: ReportTheme = {
  id: 'executive',
  name: 'Board',
  description: 'Landscape brief: key metrics first, one poster block per page. Perfect for board meetings.',
  headingFont: "'Space Grotesk', sans-serif",
  bodyFont: "'Inter', sans-serif",
  monoFont: "'JetBrains Mono', monospace",
  headingWeight: '700',
  headingSize: 'compact',
  coverBackground: 'brand',
  coverStyle: 'brand-block',
  pageBackground: '#ECEAE3',
  pageDarkBackground: '#1A1B1D',
  textColor: '#1A1B1D',
  mutedTextColor: '#6F6F68',
  orientation: 'landscape',
  sectionHeaderStyle: 'bold-block',
  density: 'compact',
  showNarratives: false,
  showHeroImages: false,
  showLeadershipPage: false,
  showSectionDividers: false,
  chartStyle: 'bar',
  pageWidth: 1123,
  pageHeight: 794,
  pagePadding: 40,
};

const DATA_DENSE: ReportTheme = {
  id: 'data-dense',
  name: 'Technical',
  description: 'Tables first, minimal narrative, tight spacing. For regulators and auditors.',
  headingFont: "'Space Grotesk', sans-serif",
  bodyFont: "'Inter', sans-serif",
  monoFont: "'JetBrains Mono', monospace",
  headingWeight: '700',
  headingSize: 'compact',
  coverBackground: 'brand',
  coverStyle: 'minimal',
  pageBackground: '#ECEAE3',
  pageDarkBackground: '#1A1B1D',
  textColor: '#1A1B1D',
  mutedTextColor: '#6F6F68',
  orientation: 'portrait',
  sectionHeaderStyle: 'divider-line',
  density: 'dense',
  showNarratives: false,
  showHeroImages: false,
  showLeadershipPage: false,
  showSectionDividers: false,
  chartStyle: 'bar',
  pageWidth: 794,
  pageHeight: 1123,
  pagePadding: 36,
};

const NARRATIVE: ReportTheme = {
  id: 'narrative',
  name: 'Editorial',
  description: 'Hero photography, full-bleed dividers, long narratives. Best for customers and supply chain.',
  headingFont: "'Space Grotesk', sans-serif",
  bodyFont: "'Inter', sans-serif",
  monoFont: "'JetBrains Mono', monospace",
  headingWeight: '700',
  headingSize: 'large',
  coverBackground: 'brand',
  coverStyle: 'editorial',
  pageBackground: '#ECEAE3',
  pageDarkBackground: '#1A1B1D',
  textColor: '#1A1B1D',
  mutedTextColor: '#6F6F68',
  orientation: 'portrait',
  sectionHeaderStyle: 'numbered',
  density: 'comfortable',
  showNarratives: true,
  showHeroImages: true,
  showLeadershipPage: true,
  showSectionDividers: true,
  chartStyle: 'donut',
  pageWidth: 794,
  pageHeight: 1123,
  pagePadding: 56,
};

// ============================================================================
// Theme registry
// ============================================================================

export const THEMES: Record<string, ReportTheme> = {
  classic: CLASSIC,
  modern: MODERN,
  executive: EXECUTIVE,
  'data-dense': DATA_DENSE,
  narrative: NARRATIVE,
};

export const THEME_LIST: ReportTheme[] = [CLASSIC, MODERN, EXECUTIVE, DATA_DENSE, NARRATIVE];

/**
 * Resolves a theme by ID. Falls back to Classic if not found.
 * If an orientation override is provided, applies it (adjusting page dimensions).
 */
export function resolveTheme(
  templateId?: string,
  orientationOverride?: 'portrait' | 'landscape'
): ReportTheme {
  const base = THEMES[templateId || 'classic'] || CLASSIC;

  if (!orientationOverride || orientationOverride === base.orientation) {
    return base;
  }

  // Override orientation and swap dimensions
  return {
    ...base,
    orientation: orientationOverride,
    pageWidth: orientationOverride === 'landscape' ? 1123 : 794,
    pageHeight: orientationOverride === 'landscape' ? 794 : 1123,
  };
}

/**
 * Returns Google Fonts import URL for a theme's font families.
 */
export function getThemeFontImport(theme: ReportTheme): string {
  const families = new Set<string>();

  // Extract family names from CSS font-family strings
  const extractFamily = (cssFont: string) => {
    const match = cssFont.match(/^'([^']+)'/);
    return match ? match[1] : null;
  };

  const heading = extractFamily(theme.headingFont);
  const body = extractFamily(theme.bodyFont);
  const mono = extractFamily(theme.monoFont);

  if (heading) families.add(`${heading}:wght@500;600;700`);
  if (body && body !== heading) families.add(`${body}:wght@400;500;600;700`);
  if (mono) families.add(`${mono}:wght@400;500;700`);

  const familyParams = Array.from(families)
    .map(f => `family=${encodeURIComponent(f)}`)
    .join('&');

  return `https://fonts.googleapis.com/css2?${familyParams}&display=swap`;
}
