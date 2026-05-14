export type SourceType =
  | 'certification_db'
  | 'brand_website'
  | 'regulatory_body'
  | 'company_registry'
  | 'other';

export type ExtractionMethod = 'dom_parse' | 'llm_extract' | 'pattern_match' | 'api';

/**
 * Confidence we assign to a freshly extracted field. The matrix mirrors
 * the spec — official directories with structured DOM are most
 * trustworthy; LLM extraction over a brand's own homepage is mid-tier
 * because the brand has incentive to exaggerate but the data still came
 * from the source-of-record.
 */
const MATRIX: Array<{ source: SourceType; method: ExtractionMethod; confidence: number }> = [
  { source: 'certification_db', method: 'api',           confidence: 0.98 },
  { source: 'certification_db', method: 'dom_parse',     confidence: 0.95 },
  { source: 'certification_db', method: 'pattern_match', confidence: 0.85 },
  { source: 'certification_db', method: 'llm_extract',   confidence: 0.80 },

  { source: 'regulatory_body',  method: 'api',           confidence: 0.95 },
  { source: 'regulatory_body',  method: 'dom_parse',     confidence: 0.85 },
  { source: 'regulatory_body',  method: 'llm_extract',   confidence: 0.75 },
  { source: 'regulatory_body',  method: 'pattern_match', confidence: 0.75 },

  { source: 'company_registry', method: 'api',           confidence: 0.95 },
  { source: 'company_registry', method: 'dom_parse',     confidence: 0.85 },
  { source: 'company_registry', method: 'pattern_match', confidence: 0.75 },
  { source: 'company_registry', method: 'llm_extract',   confidence: 0.70 },

  { source: 'brand_website',    method: 'pattern_match', confidence: 0.55 },
  { source: 'brand_website',    method: 'llm_extract',   confidence: 0.65 },
  { source: 'brand_website',    method: 'dom_parse',     confidence: 0.60 },

  { source: 'other',            method: 'llm_extract',   confidence: 0.40 },
  { source: 'other',            method: 'dom_parse',     confidence: 0.50 },
  { source: 'other',            method: 'pattern_match', confidence: 0.45 },
  { source: 'other',            method: 'api',           confidence: 0.60 },
];

export function scoreConfidence(source: SourceType, method: ExtractionMethod): number {
  const match = MATRIX.find((m) => m.source === source && m.method === method);
  if (match) return match.confidence;
  // Fallback for any unanticipated combination: pessimistic 0.5.
  return 0.5;
}
