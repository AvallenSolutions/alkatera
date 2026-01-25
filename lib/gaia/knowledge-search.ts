// Rosa Knowledge Search
// Semantic search across knowledge documents and curated content

import { createClient } from '@supabase/supabase-js';
import { generateQueryEmbedding, type DocumentCategory } from './knowledge-indexing';

type SupabaseClient = ReturnType<typeof createClient>;

/**
 * Knowledge search result
 */
export interface KnowledgeSearchResult {
  id: string;
  sourceType: 'document' | 'curated';
  documentTitle: string;
  content: string;
  category: string;
  similarity: number;
  sourceName?: string;
  sectionTitle?: string;
}

/**
 * Search options
 */
export interface KnowledgeSearchOptions {
  query: string;
  categories?: DocumentCategory[];
  organizationId?: string;
  matchThreshold?: number;
  matchCount?: number;
  includeDocuments?: boolean;
  includeCurated?: boolean;
}

/**
 * Search the knowledge base using semantic similarity
 * This is the main function Rosa uses to find relevant knowledge
 */
export async function searchKnowledge(
  supabase: SupabaseClient,
  options: KnowledgeSearchOptions
): Promise<KnowledgeSearchResult[]> {
  const {
    query,
    categories,
    organizationId,
    matchThreshold = 0.65,
    matchCount = 5,
    includeDocuments = true,
    includeCurated = true,
  } = options;

  try {
    // Generate embedding for the query
    const queryEmbedding = await generateQueryEmbedding(query);

    // Use the database function for semantic search
    const { data, error } = await supabase.rpc('search_rosa_knowledge', {
      query_embedding: `[${queryEmbedding.join(',')}]`,
      match_threshold: matchThreshold,
      match_count: matchCount * 2, // Get more to filter
      p_categories: categories || null,
      p_organization_id: organizationId || null,
    });

    if (error) {
      console.error('Error searching knowledge:', error);
      return [];
    }

    // Filter based on source type preferences
    let results: KnowledgeSearchResult[] = (data || []).map((row: {
      id: string;
      source_type: string;
      document_title: string;
      content: string;
      category: string;
      similarity: number;
      source_name?: string;
      section_title?: string;
    }) => ({
      id: row.id,
      sourceType: row.source_type as 'document' | 'curated',
      documentTitle: row.document_title,
      content: row.content,
      category: row.category,
      similarity: row.similarity,
      sourceName: row.source_name,
      sectionTitle: row.section_title,
    }));

    // Filter by source type
    if (!includeDocuments) {
      results = results.filter((r) => r.sourceType !== 'document');
    }
    if (!includeCurated) {
      results = results.filter((r) => r.sourceType !== 'curated');
    }

    // Limit to requested count
    return results.slice(0, matchCount);
  } catch (error) {
    console.error('Error in searchKnowledge:', error);
    return [];
  }
}

/**
 * Search knowledge with keyword fallback
 * If semantic search returns few results, falls back to keyword matching
 */
export async function searchKnowledgeWithFallback(
  supabase: SupabaseClient,
  options: KnowledgeSearchOptions
): Promise<KnowledgeSearchResult[]> {
  // First try semantic search
  const semanticResults = await searchKnowledge(supabase, options);

  // If we have enough results, return them
  if (semanticResults.length >= (options.matchCount || 5) / 2) {
    return semanticResults;
  }

  // Fall back to keyword search for curated knowledge
  const keywordResults = await keywordSearchCurated(supabase, options.query, options.categories);

  // Merge and deduplicate
  const allResults = [...semanticResults];
  const existingIds = new Set(semanticResults.map((r) => r.id));

  for (const result of keywordResults) {
    if (!existingIds.has(result.id)) {
      allResults.push(result);
      existingIds.add(result.id);
    }
  }

  return allResults.slice(0, options.matchCount || 5);
}

/**
 * Keyword-based search for curated knowledge
 */
async function keywordSearchCurated(
  supabase: SupabaseClient,
  query: string,
  categories?: DocumentCategory[]
): Promise<KnowledgeSearchResult[]> {
  // Extract keywords from query
  const keywords = extractKeywords(query);

  if (keywords.length === 0) {
    return [];
  }

  let queryBuilder = supabase
    .from('rosa_curated_knowledge')
    .select('id, topic, subtopic, content, category, source, keywords, priority')
    .eq('is_active', true)
    .overlaps('keywords', keywords);

  if (categories && categories.length > 0) {
    queryBuilder = queryBuilder.in('category', categories);
  }

  const { data, error } = await queryBuilder
    .order('priority', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error in keyword search:', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    sourceType: 'curated' as const,
    documentTitle: row.topic,
    content: row.content,
    category: row.category,
    similarity: 0.5, // Placeholder for keyword matches
    sourceName: row.source,
    sectionTitle: row.subtopic,
  }));
}

/**
 * Extract search keywords from a query
 */
function extractKeywords(query: string): string[] {
  // Common sustainability keywords to look for
  const sustainabilityTerms = [
    'ghg', 'greenhouse', 'carbon', 'emissions', 'scope', 'scope1', 'scope2', 'scope3',
    'sbti', 'science based', 'targets', 'net zero', 'netzero',
    'csrd', 'esrs', 'double materiality', 'materiality',
    'tcfd', 'climate risk', 'physical risk', 'transition risk',
    'iso', '14064', '14067', 'verification',
    'water', 'water stewardship', 'aws',
    'packaging', 'recycled', 'recyclability', 'circular',
    'lca', 'life cycle', 'product footprint',
    'renewable', 'energy', 'ppa', 'recs',
    'reduction', 'decarbonization',
    'drinks', 'beverage', 'brewery', 'distillery', 'winery',
    'benchmark', 'intensity', 'reporting',
  ];

  const queryLower = query.toLowerCase();
  const foundKeywords: string[] = [];

  for (const term of sustainabilityTerms) {
    if (queryLower.includes(term)) {
      foundKeywords.push(term);
    }
  }

  return foundKeywords;
}

/**
 * Get relevant knowledge for a Rosa query
 * This is the main entry point used by the context builder
 */
export async function getRelevantKnowledge(
  supabase: SupabaseClient,
  query: string,
  organizationId?: string
): Promise<{
  results: KnowledgeSearchResult[];
  formattedContext: string;
}> {
  // Detect what categories might be relevant
  const categories = detectRelevantCategories(query);

  // Search with fallback
  const results = await searchKnowledgeWithFallback(supabase, {
    query,
    categories: categories.length > 0 ? categories : undefined,
    organizationId,
    matchThreshold: 0.6,
    matchCount: 5,
    includeDocuments: true,
    includeCurated: true,
  });

  // Format for inclusion in Rosa's context
  const formattedContext = formatKnowledgeForContext(results);

  return { results, formattedContext };
}

/**
 * Detect which knowledge categories are relevant to a query
 */
function detectRelevantCategories(query: string): DocumentCategory[] {
  const queryLower = query.toLowerCase();
  const categories: DocumentCategory[] = [];

  // GHG Protocol
  if (
    queryLower.includes('ghg') ||
    queryLower.includes('scope') ||
    queryLower.includes('emissions') ||
    queryLower.includes('carbon footprint')
  ) {
    categories.push('ghg_protocol');
  }

  // SBTi
  if (
    queryLower.includes('sbti') ||
    queryLower.includes('science based') ||
    queryLower.includes('net zero') ||
    queryLower.includes('target')
  ) {
    categories.push('sbti');
  }

  // Regulations
  if (
    queryLower.includes('csrd') ||
    queryLower.includes('regulation') ||
    queryLower.includes('compliance') ||
    queryLower.includes('legal') ||
    queryLower.includes('esrs')
  ) {
    categories.push('regulations');
  }

  // Industry standards
  if (
    queryLower.includes('iso') ||
    queryLower.includes('standard') ||
    queryLower.includes('certification')
  ) {
    categories.push('industry_standards');
  }

  // Best practices
  if (
    queryLower.includes('best practice') ||
    queryLower.includes('how to') ||
    queryLower.includes('approach') ||
    queryLower.includes('strategy')
  ) {
    categories.push('best_practices');
  }

  // Methodology
  if (
    queryLower.includes('calculate') ||
    queryLower.includes('methodology') ||
    queryLower.includes('method') ||
    queryLower.includes('formula')
  ) {
    categories.push('methodology');
  }

  return categories;
}

/**
 * Format knowledge results for inclusion in Rosa's context
 */
function formatKnowledgeForContext(results: KnowledgeSearchResult[]): string {
  if (results.length === 0) {
    return '';
  }

  const lines: string[] = ['## RELEVANT KNOWLEDGE BASE INFORMATION\n'];

  results.forEach((result, index) => {
    lines.push(`### ${index + 1}. ${result.documentTitle}`);

    if (result.sectionTitle && result.sectionTitle !== result.documentTitle) {
      lines.push(`*Section: ${result.sectionTitle}*`);
    }

    if (result.sourceName) {
      lines.push(`*Source: ${result.sourceName}*`);
    }

    lines.push('');
    lines.push(result.content);
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Get knowledge statistics
 */
export async function getKnowledgeStats(
  supabase: SupabaseClient
): Promise<{
  totalDocuments: number;
  readyDocuments: number;
  totalChunks: number;
  curatedEntries: number;
  categoryCounts: Record<string, number>;
}> {
  // Get document counts
  const { count: totalDocs } = await supabase
    .from('rosa_knowledge_documents')
    .select('*', { count: 'exact', head: true });

  const { count: readyDocs } = await supabase
    .from('rosa_knowledge_documents')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'ready');

  const { count: totalChunks } = await supabase
    .from('rosa_knowledge_chunks')
    .select('*', { count: 'exact', head: true });

  const { count: curatedCount } = await supabase
    .from('rosa_curated_knowledge')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  // Get category breakdown
  const { data: categoryData } = await supabase
    .from('rosa_knowledge_documents')
    .select('category')
    .eq('status', 'ready');

  const categoryCounts: Record<string, number> = {};
  (categoryData || []).forEach((row) => {
    categoryCounts[row.category] = (categoryCounts[row.category] || 0) + 1;
  });

  return {
    totalDocuments: totalDocs || 0,
    readyDocuments: readyDocs || 0,
    totalChunks: totalChunks || 0,
    curatedEntries: curatedCount || 0,
    categoryCounts,
  };
}
