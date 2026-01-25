// Rosa Context Builder
// Assembles context for Gemini API calls

import { ROSA_SYSTEM_PROMPT, ROSA_CONTEXT_TEMPLATE } from './system-prompt';
import { formatContextForPrompt, type DataRetrievalResult } from './data-retrieval';
import { formatDataQualityForPrompt, type RosaDataQualityMetrics } from './data-quality';
import { formatBenchmarksForPrompt, type RosaIndustryBenchmarks } from './benchmarking';
import { formatTrendReportForPrompt, type RosaTrendReport } from './trend-analysis';
import { getRelevantKnowledge, type KnowledgeSearchResult } from './knowledge-search';
import type { RosaMessage, RosaKnowledgeEntry } from '@/lib/types/gaia';

export interface RosaPromptContext {
  systemPrompt: string;
  userPrompt: string;
  conversationHistory: string;
}

// Extended context with new feature data
export interface RosaEnhancedContext {
  dataQuality?: RosaDataQualityMetrics;
  benchmarks?: RosaIndustryBenchmarks;
  trends?: RosaTrendReport;
  externalKnowledge?: string; // Pre-formatted knowledge from RAG search
}

// Backwards compatibility
/** @deprecated Use RosaPromptContext instead */
export type GaiaPromptContext = RosaPromptContext;

/**
 * Build the complete context for a Rosa query
 * Now supports enhanced context with data quality, benchmarks, and trends
 */
export function buildRosaContext(params: {
  organizationContext: DataRetrievalResult;
  knowledgeBase: RosaKnowledgeEntry[];
  conversationHistory: RosaMessage[];
  userQuery: string;
  enhancedContext?: RosaEnhancedContext;
}): RosaPromptContext {
  const { organizationContext, knowledgeBase, conversationHistory, userQuery, enhancedContext } = params;

  // Format organization context
  const orgContextStr = formatContextForPrompt(organizationContext);

  // Format knowledge base entries
  const knowledgeStr = formatKnowledgeBase(knowledgeBase);

  // Format conversation history
  const historyStr = formatConversationHistory(conversationHistory);

  // Format enhanced context sections
  const enhancedContextStr = formatEnhancedContext(enhancedContext);

  // Build the user prompt from template
  let userPrompt = ROSA_CONTEXT_TEMPLATE
    .replace('{organization_context}', orgContextStr)
    .replace('{knowledge_base}', knowledgeStr)
    .replace('{conversation_history}', historyStr)
    .replace('{user_query}', userQuery);

  // Append enhanced context if available
  if (enhancedContextStr) {
    userPrompt = userPrompt + '\n\n## ENHANCED INSIGHTS\n' + enhancedContextStr;
  }

  return {
    systemPrompt: ROSA_SYSTEM_PROMPT,
    userPrompt,
    conversationHistory: historyStr,
  };
}

/**
 * Format enhanced context (data quality, benchmarks, trends, external knowledge)
 */
function formatEnhancedContext(context?: RosaEnhancedContext): string {
  if (!context) return '';

  const sections: string[] = [];

  // External knowledge (RAG results) - added first for prominence
  if (context.externalKnowledge) {
    sections.push(context.externalKnowledge);
  }

  // Data quality insights
  if (context.dataQuality) {
    sections.push(formatDataQualityForPrompt(context.dataQuality));
  }

  // Industry benchmarks
  if (context.benchmarks) {
    sections.push(formatBenchmarksForPrompt(context.benchmarks));
  }

  // Trend analysis
  if (context.trends) {
    sections.push(formatTrendReportForPrompt(context.trends));
  }

  return sections.join('\n\n');
}

// Backwards compatibility
/** @deprecated Use buildRosaContext instead */
export const buildGaiaContext = buildRosaContext;

/**
 * Format knowledge base entries for context
 */
function formatKnowledgeBase(entries: RosaKnowledgeEntry[]): string {
  if (!entries || entries.length === 0) {
    return 'No additional knowledge base entries.';
  }

  // Sort by priority (higher first)
  const sorted = [...entries].sort((a, b) => (b.priority || 0) - (a.priority || 0));

  const sections: Record<string, string[]> = {
    guideline: [],
    instruction: [],
    definition: [],
    example_qa: [],
  };

  sorted.forEach((entry) => {
    if (entry.entry_type === 'example_qa' && entry.example_question && entry.example_answer) {
      sections.example_qa.push(
        `Q: ${entry.example_question}\nA: ${entry.example_answer}`
      );
    } else if (entry.entry_type === 'definition') {
      sections.definition.push(`**${entry.title}**: ${entry.content}`);
    } else {
      const section = entry.entry_type === 'guideline' ? 'guideline' : 'instruction';
      sections[section].push(`- ${entry.title}: ${entry.content}`);
    }
  });

  const lines: string[] = [];

  if (sections.guideline.length > 0) {
    lines.push('### Guidelines');
    lines.push(sections.guideline.join('\n'));
    lines.push('');
  }

  if (sections.instruction.length > 0) {
    lines.push('### Instructions');
    lines.push(sections.instruction.join('\n'));
    lines.push('');
  }

  if (sections.definition.length > 0) {
    lines.push('### Key Definitions');
    lines.push(sections.definition.join('\n'));
    lines.push('');
  }

  if (sections.example_qa.length > 0) {
    lines.push('### Example Q&A (use these as guidance for similar questions)');
    lines.push(sections.example_qa.join('\n\n'));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format conversation history for context
 */
function formatConversationHistory(messages: RosaMessage[]): string {
  if (!messages || messages.length === 0) {
    return 'No previous messages in this conversation.';
  }

  // Limit to last 10 messages to avoid context overflow
  const recentMessages = messages.slice(-10);

  return recentMessages
    .map((msg) => {
      const role = msg.role === 'user' ? 'User' : 'Rosa';
      return `${role}: ${msg.content}`;
    })
    .join('\n\n');
}

/**
 * Extract potential query intent from user message
 * Used to fetch more detailed data if needed
 */
export function detectQueryIntent(query: string): string[] {
  const intents: string[] = [];
  const queryLower = query.toLowerCase();

  // Emissions-related
  if (
    queryLower.includes('emission') ||
    queryLower.includes('carbon') ||
    queryLower.includes('co2') ||
    queryLower.includes('footprint') ||
    queryLower.includes('scope')
  ) {
    intents.push('emissions');
  }

  // Product-related
  if (
    queryLower.includes('product') ||
    queryLower.includes('lca') ||
    queryLower.includes('life cycle') ||
    queryLower.includes('impact')
  ) {
    intents.push('product');
  }

  // Facility-related
  if (
    queryLower.includes('facility') ||
    queryLower.includes('facilities') ||
    queryLower.includes('site') ||
    queryLower.includes('location') ||
    queryLower.includes('building')
  ) {
    intents.push('facility');
  }

  // Water-related
  if (
    queryLower.includes('water') ||
    queryLower.includes('consumption') ||
    queryLower.includes('h2o')
  ) {
    intents.push('water');
  }

  // Energy-related
  if (
    queryLower.includes('energy') ||
    queryLower.includes('electricity') ||
    queryLower.includes('power') ||
    queryLower.includes('fuel')
  ) {
    intents.push('energy');
  }

  // Fleet-related
  if (
    queryLower.includes('fleet') ||
    queryLower.includes('vehicle') ||
    queryLower.includes('travel') ||
    queryLower.includes('transport') ||
    queryLower.includes('mileage') ||
    queryLower.includes('distance')
  ) {
    intents.push('fleet');
  }

  // Supplier-related
  if (
    queryLower.includes('supplier') ||
    queryLower.includes('vendor') ||
    queryLower.includes('value chain') ||
    queryLower.includes('upstream') ||
    queryLower.includes('downstream')
  ) {
    intents.push('supplier');
  }

  // Vitality score
  if (
    queryLower.includes('vitality') ||
    queryLower.includes('score') ||
    queryLower.includes('rating') ||
    queryLower.includes('performance')
  ) {
    intents.push('vitality');
  }

  // Comparison/trend
  if (
    queryLower.includes('compare') ||
    queryLower.includes('trend') ||
    queryLower.includes('last year') ||
    queryLower.includes('previous') ||
    queryLower.includes('change') ||
    queryLower.includes('improve')
  ) {
    intents.push('trend');
  }

  return intents;
}

/**
 * Generate chart configuration based on data and query
 */
export function suggestChartType(
  intents: string[],
  data: unknown
): { type: string; suggestion: string } | null {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  // Trend queries - line chart
  if (intents.includes('trend')) {
    return { type: 'line', suggestion: 'A line chart would show the trend over time' };
  }

  // Breakdown/comparison queries - bar or pie
  if (data.length <= 6) {
    return { type: 'pie', suggestion: 'A pie chart would show the breakdown effectively' };
  } else if (data.length <= 20) {
    return { type: 'bar', suggestion: 'A bar chart would allow comparison across items' };
  }

  // Many items - table
  return { type: 'table', suggestion: 'A table would be best for displaying this many items' };
}

/**
 * Fetch relevant external knowledge for a query
 * This is called before building context to enrich Rosa's responses
 */
export async function fetchExternalKnowledge(
  query: string,
  organizationId?: string
): Promise<{ formattedContext: string; results: KnowledgeSearchResult[] }> {
  try {
    const { results, formattedContext } = await getRelevantKnowledge(query, organizationId);
    return { formattedContext, results };
  } catch (error) {
    console.error('Error fetching external knowledge:', error);
    return { formattedContext: '', results: [] };
  }
}

/**
 * Build Rosa context with automatic knowledge retrieval
 * This is the recommended entry point that handles everything
 */
export async function buildRosaContextWithKnowledge(params: {
  organizationContext: DataRetrievalResult;
  knowledgeBase: RosaKnowledgeEntry[];
  conversationHistory: RosaMessage[];
  userQuery: string;
  organizationId?: string;
  enhancedContext?: Omit<RosaEnhancedContext, 'externalKnowledge'>;
}): Promise<RosaPromptContext> {
  const { organizationId, userQuery, enhancedContext, ...rest } = params;

  // Fetch relevant external knowledge
  const { formattedContext: externalKnowledge } = await fetchExternalKnowledge(
    userQuery,
    organizationId
  );

  // Build context with external knowledge included
  return buildRosaContext({
    ...rest,
    userQuery,
    enhancedContext: {
      ...enhancedContext,
      externalKnowledge,
    },
  });
}
