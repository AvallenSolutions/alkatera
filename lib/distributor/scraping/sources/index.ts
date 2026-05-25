import { brandWebsiteSource } from './brand-website';
import { wikipediaSource } from './wikipedia';
import { bcorpSource } from './bcorp';
import type { SourceScraper } from './types';

/**
 * Sources the agent will iterate over, ordered by reliability (most
 * trustworthy first). Add new scrapers here as we implement them — the
 * brand-agent does not need to change.
 *
 * The names MUST match rows in public.scraping_sources so the agent can
 * cross-reference source_type + reliability stored in the DB.
 */
export const ALL_SOURCES: SourceScraper[] = [
  bcorpSource,
  brandWebsiteSource,
  wikipediaSource,
];

export function getSourceByName(name: string): SourceScraper | undefined {
  return ALL_SOURCES.find((s) => s.name === name);
}

export {
  type SourceScraper,
  type BrandSnapshot,
  type SourceFinding,
  type SourceRunResult,
  type CrawledProduct,
  type CrawledDocument,
  type CrawledDocumentKind,
} from './types';
