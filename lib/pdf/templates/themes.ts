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
  name: 'Classic',
  description: 'Dark cover, serif headings, warm tones. Ideal for investors and stakeholders.',
  headingFont: "'Playfair Display', serif",
  bodyFont: "'Inter', sans-serif",
  monoFont: "'Fira Code', monospace",
  headingWeight: '300',
  headingSize: 'large',
  coverBackground: 'dark',
  coverStyle: 'hero-photo',
  pageBackground: '#f5f5f4',
  pageDarkBackground: '#1c1917',
  textColor: '#1c1917',
  mutedTextColor: '#78716c',
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
  name: 'Modern',
  description: 'Clean sans-serif, light cover, minimal colour blocks. Great for customer-facing reports.',
  headingFont: "'Inter', sans-serif",
  bodyFont: "'Inter', sans-serif",
  monoFont: "'Fira Code', monospace",
  headingWeight: '700',
  headingSize: 'medium',
  coverBackground: 'light',
  coverStyle: 'minimal',
  pageBackground: '#ffffff',
  pageDarkBackground: '#18181b',
  textColor: '#18181b',
  mutedTextColor: '#71717a',
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
  name: 'Executive Brief',
  description: 'Condensed, dark theme, key metrics first. Perfect for board meetings.',
  headingFont: "'Inter', sans-serif",
  bodyFont: "'Inter', sans-serif",
  monoFont: "'Fira Code', monospace",
  headingWeight: '700',
  headingSize: 'compact',
  coverBackground: 'dark',
  coverStyle: 'brand-block',
  pageBackground: '#1c1917',
  pageDarkBackground: '#1c1917',
  textColor: '#fafaf9',
  mutedTextColor: '#a8a29e',
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
  description: 'Tables and charts first, minimal narrative, tight spacing. For regulators and auditors.',
  headingFont: "'Inter', sans-serif",
  bodyFont: "'Inter', sans-serif",
  monoFont: "'Fira Code', monospace",
  headingWeight: '700',
  headingSize: 'compact',
  coverBackground: 'light',
  coverStyle: 'minimal',
  pageBackground: '#ffffff',
  pageDarkBackground: '#1e293b',
  textColor: '#0f172a',
  mutedTextColor: '#64748b',
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
  name: 'Storytelling',
  description: 'Editorial feel, hero photography, long narratives. Best for customers and supply chain.',
  headingFont: "'Playfair Display', serif",
  bodyFont: "'Inter', sans-serif",
  monoFont: "'Fira Code', monospace",
  headingWeight: '300',
  headingSize: 'large',
  coverBackground: 'dark',
  coverStyle: 'editorial',
  pageBackground: '#fafaf9',
  pageDarkBackground: '#1c1917',
  textColor: '#292524',
  mutedTextColor: '#78716c',
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

  if (heading) families.add(`${heading}:wght@300;700`);
  if (body && body !== heading) families.add(`${body}:wght@300;400;500;600;700`);
  if (mono) families.add(`${mono}:wght@400;700`);

  const familyParams = Array.from(families)
    .map(f => `family=${encodeURIComponent(f)}`)
    .join('&');

  return `https://fonts.googleapis.com/css2?${familyParams}&display=swap`;
}
