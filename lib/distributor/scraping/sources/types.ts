import type { FieldKey } from '../field-definitions';
import type { ExtractionMethod, SourceType } from '../confidence-scorer';

export interface SourceFinding {
  field_key: FieldKey;
  raw_value: unknown;
  extraction_method: ExtractionMethod;
  source_url: string;
}

export interface CrawledProduct {
  /** Display name as it appeared on the page. */
  name: string;
  /** spirits | wine | beer | non_alc | other, when the page makes it clear. */
  category?: string | null;
  /** Alcohol by volume, percentage (e.g. 41.2). */
  abv?: number | null;
  /** Container size in millilitres, when stated. */
  container_size_ml?: number | null;
  /** bottle | can | keg | bag_in_box | other. */
  container_format?: string | null;
  /** URL of the page the product was found on. */
  source_url: string;
}

export interface SourceRunResult {
  ok: boolean;
  /** Truthy when the source itself decided to skip (e.g. no website URL on file). */
  skipped?: boolean;
  /** Why we skipped or failed — used for the job's error_message. */
  reason?: string;
  /** Findings to write to scraped_brand_data. */
  findings: SourceFinding[];
  /** Products discovered during the scrape — persisted into product_directory. */
  products?: CrawledProduct[];
}

export interface BrandSnapshot {
  id: string;
  name: string;
  normalized_name: string;
  website: string | null;
  country_of_origin: string | null;
  category: string | null;
}

export interface SourceScraper {
  /** Display name — must match a row in scraping_sources.name. */
  name: string;
  source_type: SourceType;
  run(brand: BrandSnapshot): Promise<SourceRunResult>;
}
