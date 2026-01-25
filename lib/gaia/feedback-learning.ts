// Rosa Feedback Learning Module
// Feature 5: Continuous Improvement through Feedback Analysis

import { createClient } from '@supabase/supabase-js';
import type {
  RosaFeedbackPattern,
  RosaFeedbackAnalytics,
  RosaKnowledgeEntryInput,
} from '@/lib/types/gaia';

type SupabaseClient = ReturnType<typeof createClient>;

// Common question patterns for categorization
const QUESTION_CATEGORIES: { pattern: RegExp; category: string }[] = [
  { pattern: /how (do|can|should) i/i, category: 'how-to' },
  { pattern: /what (is|are|does)/i, category: 'explanation' },
  { pattern: /where (can|do|is)/i, category: 'navigation' },
  { pattern: /(calculate|show|display|report)/i, category: 'data-query' },
  { pattern: /(emission|carbon|co2|footprint)/i, category: 'emissions' },
  { pattern: /(water|consumption)/i, category: 'water' },
  { pattern: /(product|lca|ingredient|packaging)/i, category: 'products' },
  { pattern: /(facility|site|location)/i, category: 'facilities' },
  { pattern: /(supplier|vendor|scope 3)/i, category: 'suppliers' },
  { pattern: /(vitality|score|benchmark)/i, category: 'vitality' },
  { pattern: /(help|stuck|error|problem)/i, category: 'troubleshooting' },
];

/**
 * Analyze feedback patterns to identify areas for improvement
 */
export async function analyzeFeedbackPatterns(
  supabase: SupabaseClient,
  periodDays: number = 30
): Promise<RosaFeedbackAnalytics> {
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - periodDays);

  // Fetch feedback with messages
  const { data: feedbackData } = await supabase
    .from('gaia_feedback')
    .select(`
      id, rating, feedback_text, created_at,
      message:gaia_messages!message_id (
        id, content, role,
        conversation:gaia_conversations!conversation_id (
          id
        )
      )
    `)
    .gte('created_at', periodStart.toISOString())
    .order('created_at', { ascending: false });

  const feedback = feedbackData as Array<{
    id: string;
    rating: 'positive' | 'negative';
    feedback_text: string | null;
    created_at: string;
    message: {
      id: string;
      content: string;
      role: string;
      conversation: { id: string };
    };
  }> | null;

  if (!feedback || feedback.length === 0) {
    return {
      periodStart: periodStart.toISOString(),
      periodEnd: new Date().toISOString(),
      totalFeedback: 0,
      positiveCount: 0,
      negativeCount: 0,
      positiveRate: 0,
      topNegativePatterns: [],
      topPositivePatterns: [],
      categoryBreakdown: [],
      improvementSuggestions: [],
      knowledgeGaps: [],
    };
  }

  // Calculate basic stats
  const totalFeedback = feedback.length;
  const positiveCount = feedback.filter(f => f.rating === 'positive').length;
  const negativeCount = feedback.filter(f => f.rating === 'negative').length;
  const positiveRate = totalFeedback > 0 ? (positiveCount / totalFeedback) * 100 : 0;

  // Analyze patterns in negative feedback
  const negativeFeedback = feedback.filter(f => f.rating === 'negative');
  const positiveFeedback = feedback.filter(f => f.rating === 'positive');

  // Get conversation context for negative feedback
  const negativePatterns = await analyzeNegativePatterns(supabase, negativeFeedback);
  const positivePatterns = analyzePositivePatterns(positiveFeedback);

  // Categorize feedback
  const categoryBreakdown = calculateCategoryBreakdown(feedback);

  // Generate improvement suggestions
  const improvementSuggestions = generateImprovementSuggestions(
    negativePatterns,
    categoryBreakdown,
    positiveRate
  );

  // Identify knowledge gaps
  const knowledgeGaps = identifyKnowledgeGaps(negativeFeedback);

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: new Date().toISOString(),
    totalFeedback,
    positiveCount,
    negativeCount,
    positiveRate: Math.round(positiveRate * 10) / 10,
    topNegativePatterns: negativePatterns.slice(0, 10),
    topPositivePatterns: positivePatterns.slice(0, 5),
    categoryBreakdown,
    improvementSuggestions,
    knowledgeGaps: knowledgeGaps.slice(0, 5),
  };
}

/**
 * Analyze patterns in negative feedback
 */
async function analyzeNegativePatterns(
  supabase: SupabaseClient,
  negativeFeedback: Array<{
    id: string;
    rating: 'positive' | 'negative';
    feedback_text: string | null;
    created_at: string;
    message: {
      id: string;
      content: string;
      role: string;
      conversation: { id: string };
    };
  }>
): Promise<RosaFeedbackPattern[]> {
  const patterns = new Map<string, RosaFeedbackPattern>();

  for (const item of negativeFeedback) {
    // Get the user question that preceded this response
    const { data: messages } = await supabase
      .from('gaia_messages')
      .select('content, role')
      .eq('conversation_id', item.message.conversation.id)
      .order('created_at', { ascending: true });

    const messageList = messages as Array<{ content: string; role: string }> | null;

    if (!messageList) continue;

    // Find the user message that preceded the rated assistant message
    const assistantIndex = messageList.findIndex(m =>
      m.content === item.message.content && m.role === 'assistant'
    );

    if (assistantIndex > 0) {
      const userQuestion = messageList[assistantIndex - 1]?.content || '';
      const category = categorizeQuestion(userQuestion);
      const patternKey = extractPatternKey(userQuestion);

      const existing = patterns.get(patternKey);
      if (existing) {
        existing.negativeCount++;
        existing.lastOccurrence = item.created_at;
        existing.successRate = existing.positiveCount / (existing.positiveCount + existing.negativeCount);
      } else {
        patterns.set(patternKey, {
          id: crypto.randomUUID(),
          pattern: patternKey,
          category,
          negativeCount: 1,
          positiveCount: 0,
          successRate: 0,
          lastOccurrence: item.created_at,
          status: 'pending_review',
          suggestedKnowledgeEntry: generateSuggestedKnowledgeEntry(userQuestion, category),
        });
      }
    }
  }

  return Array.from(patterns.values())
    .sort((a, b) => b.negativeCount - a.negativeCount);
}

/**
 * Analyze patterns in positive feedback
 */
function analyzePositivePatterns(
  positiveFeedback: Array<{
    id: string;
    rating: 'positive' | 'negative';
    feedback_text: string | null;
    created_at: string;
    message: {
      id: string;
      content: string;
      role: string;
    };
  }>
): RosaFeedbackPattern[] {
  const patterns = new Map<string, RosaFeedbackPattern>();

  for (const item of positiveFeedback) {
    const category = categorizeQuestion(item.message.content);
    const patternKey = `positive_${category}`;

    const existing = patterns.get(patternKey);
    if (existing) {
      existing.positiveCount++;
      existing.lastOccurrence = item.created_at;
    } else {
      patterns.set(patternKey, {
        id: crypto.randomUUID(),
        pattern: `Responses about ${category}`,
        category,
        negativeCount: 0,
        positiveCount: 1,
        successRate: 1,
        lastOccurrence: item.created_at,
        status: 'addressed',
      });
    }
  }

  return Array.from(patterns.values())
    .sort((a, b) => b.positiveCount - a.positiveCount);
}

/**
 * Categorize a question based on patterns
 */
function categorizeQuestion(question: string): string {
  for (const { pattern, category } of QUESTION_CATEGORIES) {
    if (pattern.test(question)) {
      return category;
    }
  }
  return 'general';
}

/**
 * Extract a pattern key from a question for grouping similar questions
 */
function extractPatternKey(question: string): string {
  // Remove specific data and normalize the question
  let normalized = question.toLowerCase()
    .replace(/\d+/g, 'N') // Replace numbers
    .replace(/['"]/g, '') // Remove quotes
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  // Truncate to first 50 characters for grouping
  if (normalized.length > 50) {
    normalized = normalized.substring(0, 50) + '...';
  }

  return normalized;
}

/**
 * Generate a suggested knowledge base entry for a pattern
 */
function generateSuggestedKnowledgeEntry(
  question: string,
  category: string
): RosaKnowledgeEntryInput {
  const entryType = category === 'how-to' || category === 'navigation'
    ? 'instruction'
    : category === 'explanation'
      ? 'definition'
      : 'example_qa';

  return {
    entry_type: entryType,
    title: `Answer for: ${question.substring(0, 100)}`,
    content: `[TODO: Add a clear answer to this question]`,
    example_question: question,
    example_answer: '[TODO: Add example answer]',
    category,
    tags: [category],
    is_active: false, // Start as inactive until reviewed
    priority: 5,
  };
}

/**
 * Calculate breakdown by category
 */
function calculateCategoryBreakdown(
  feedback: Array<{
    rating: 'positive' | 'negative';
    message: { content: string };
  }>
): RosaFeedbackAnalytics['categoryBreakdown'] {
  const categories = new Map<string, { positive: number; total: number }>();

  for (const item of feedback) {
    const category = categorizeQuestion(item.message.content);
    const existing = categories.get(category) || { positive: 0, total: 0 };
    existing.total++;
    if (item.rating === 'positive') {
      existing.positive++;
    }
    categories.set(category, existing);
  }

  return Array.from(categories.entries())
    .map(([category, { positive, total }]) => ({
      category,
      positiveRate: Math.round((positive / total) * 100 * 10) / 10,
      totalCount: total,
    }))
    .sort((a, b) => b.totalCount - a.totalCount);
}

/**
 * Generate improvement suggestions based on analysis
 */
function generateImprovementSuggestions(
  negativePatterns: RosaFeedbackPattern[],
  categoryBreakdown: RosaFeedbackAnalytics['categoryBreakdown'],
  overallPositiveRate: number
): RosaFeedbackAnalytics['improvementSuggestions'] {
  const suggestions: RosaFeedbackAnalytics['improvementSuggestions'] = [];

  // Suggestion based on worst performing categories
  const worstCategories = categoryBreakdown
    .filter(c => c.totalCount >= 3)
    .sort((a, b) => a.positiveRate - b.positiveRate)
    .slice(0, 2);

  for (const category of worstCategories) {
    if (category.positiveRate < 70) {
      suggestions.push({
        priority: 1,
        suggestion: `Improve responses for "${category.category}" questions (currently ${category.positiveRate}% positive)`,
        expectedImpact: `Could improve overall satisfaction by ~${Math.round((70 - category.positiveRate) * category.totalCount / 100)}%`,
        relatedPatterns: negativePatterns
          .filter(p => p.category === category.category)
          .map(p => p.pattern)
          .slice(0, 3),
      });
    }
  }

  // Suggestion based on most common negative patterns
  if (negativePatterns.length > 0) {
    const topPattern = negativePatterns[0];
    suggestions.push({
      priority: 2,
      suggestion: `Address frequently failing pattern: "${topPattern.pattern.substring(0, 50)}..."`,
      expectedImpact: `This pattern has ${topPattern.negativeCount} negative ratings`,
      relatedPatterns: [topPattern.pattern],
    });
  }

  // General suggestions based on overall rate
  if (overallPositiveRate < 80) {
    suggestions.push({
      priority: 3,
      suggestion: 'Add more example Q&A pairs to the knowledge base for common questions',
      expectedImpact: 'Example responses typically improve accuracy by 15-20%',
      relatedPatterns: [],
    });
  }

  if (overallPositiveRate < 90) {
    suggestions.push({
      priority: 4,
      suggestion: 'Review and update system prompt instructions for problem areas',
      expectedImpact: 'Clearer instructions can improve response quality',
      relatedPatterns: [],
    });
  }

  return suggestions.sort((a, b) => a.priority - b.priority);
}

/**
 * Identify knowledge gaps from negative feedback
 */
function identifyKnowledgeGaps(
  negativeFeedback: Array<{
    id: string;
    rating: 'positive' | 'negative';
    feedback_text: string | null;
    message: { content: string };
  }>
): RosaFeedbackAnalytics['knowledgeGaps'] {
  const topicCounts = new Map<string, { count: number; feedbackTexts: string[] }>();

  for (const item of negativeFeedback) {
    const category = categorizeQuestion(item.message.content);

    const existing = topicCounts.get(category) || { count: 0, feedbackTexts: [] };
    existing.count++;
    if (item.feedback_text) {
      existing.feedbackTexts.push(item.feedback_text);
    }
    topicCounts.set(category, existing);
  }

  return Array.from(topicCounts.entries())
    .filter(([, data]) => data.count >= 2)
    .map(([topic, data]) => ({
      topic,
      questionCount: data.count,
      avgRating: 0, // All negative in this context
      suggestedContent: data.feedbackTexts.length > 0
        ? `User feedback: ${data.feedbackTexts[0].substring(0, 100)}`
        : `Users are struggling with ${topic} related questions`,
    }))
    .sort((a, b) => b.questionCount - a.questionCount);
}

/**
 * Auto-generate knowledge entries from patterns
 */
export async function generateKnowledgeFromPatterns(
  supabase: SupabaseClient,
  patterns: RosaFeedbackPattern[],
  adminUserId: string
): Promise<number> {
  let created = 0;

  for (const pattern of patterns) {
    if (!pattern.suggestedKnowledgeEntry) continue;
    if (pattern.status !== 'pending_review') continue;

    // Check if similar entry already exists
    const { data: existing } = await supabase
      .from('gaia_knowledge_base')
      .select('id')
      .ilike('example_question', `%${pattern.suggestedKnowledgeEntry.example_question?.substring(0, 30) || ''}%`)
      .limit(1);

    if (existing && existing.length > 0) continue;

    // Create the knowledge entry
    const { error } = await supabase
      .from('gaia_knowledge_base')
      .insert({
        created_by: adminUserId,
        entry_type: pattern.suggestedKnowledgeEntry.entry_type,
        title: pattern.suggestedKnowledgeEntry.title,
        content: pattern.suggestedKnowledgeEntry.content,
        example_question: pattern.suggestedKnowledgeEntry.example_question,
        example_answer: pattern.suggestedKnowledgeEntry.example_answer,
        category: pattern.suggestedKnowledgeEntry.category,
        tags: pattern.suggestedKnowledgeEntry.tags,
        is_active: false,
        priority: pattern.suggestedKnowledgeEntry.priority,
      });

    if (!error) {
      created++;
    }
  }

  return created;
}

/**
 * Get feedback statistics for a specific time period
 */
export async function getFeedbackStats(
  supabase: SupabaseClient,
  organizationId?: string,
  periodDays: number = 7
): Promise<{
  totalFeedback: number;
  positiveRate: number;
  trend: 'improving' | 'declining' | 'stable';
  topIssues: string[];
}> {
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - periodDays);

  const previousPeriodStart = new Date(periodStart);
  previousPeriodStart.setDate(previousPeriodStart.getDate() - periodDays);

  // Current period
  let currentQuery = supabase
    .from('gaia_feedback')
    .select('rating')
    .gte('created_at', periodStart.toISOString());

  if (organizationId) {
    currentQuery = currentQuery.eq('organization_id', organizationId);
  }

  const { data: currentData } = await currentQuery;

  // Previous period
  let previousQuery = supabase
    .from('gaia_feedback')
    .select('rating')
    .gte('created_at', previousPeriodStart.toISOString())
    .lt('created_at', periodStart.toISOString());

  if (organizationId) {
    previousQuery = previousQuery.eq('organization_id', organizationId);
  }

  const { data: previousData } = await previousQuery;

  const currentFeedback = currentData as Array<{ rating: 'positive' | 'negative' }> | null;
  const previousFeedback = previousData as Array<{ rating: 'positive' | 'negative' }> | null;

  const currentTotal = currentFeedback?.length || 0;
  const currentPositive = currentFeedback?.filter(f => f.rating === 'positive').length || 0;
  const currentRate = currentTotal > 0 ? (currentPositive / currentTotal) * 100 : 0;

  const previousTotal = previousFeedback?.length || 0;
  const previousPositive = previousFeedback?.filter(f => f.rating === 'positive').length || 0;
  const previousRate = previousTotal > 0 ? (previousPositive / previousTotal) * 100 : 0;

  // Determine trend
  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  if (currentRate > previousRate + 5) {
    trend = 'improving';
  } else if (currentRate < previousRate - 5) {
    trend = 'declining';
  }

  return {
    totalFeedback: currentTotal,
    positiveRate: Math.round(currentRate * 10) / 10,
    trend,
    topIssues: [], // Would be populated from pattern analysis
  };
}

/**
 * Format feedback analytics for Rosa's context
 */
export function formatFeedbackAnalyticsForPrompt(analytics: RosaFeedbackAnalytics): string {
  const lines: string[] = [];

  lines.push('### Feedback Analytics');
  lines.push(`Period: Last ${Math.round((new Date(analytics.periodEnd).getTime() - new Date(analytics.periodStart).getTime()) / (1000 * 60 * 60 * 24))} days`);
  lines.push(`Total Feedback: ${analytics.totalFeedback} (${analytics.positiveRate}% positive)`);
  lines.push('');

  if (analytics.categoryBreakdown.length > 0) {
    lines.push('**Performance by Category:**');
    for (const category of analytics.categoryBreakdown.slice(0, 5)) {
      const icon = category.positiveRate >= 80 ? '✅' : category.positiveRate >= 60 ? '⚠️' : '🔴';
      lines.push(`- ${icon} ${category.category}: ${category.positiveRate}% positive (${category.totalCount} responses)`);
    }
    lines.push('');
  }

  if (analytics.improvementSuggestions.length > 0) {
    lines.push('**Improvement Priorities:**');
    for (const suggestion of analytics.improvementSuggestions.slice(0, 3)) {
      lines.push(`${suggestion.priority}. ${suggestion.suggestion}`);
    }
    lines.push('');
  }

  if (analytics.knowledgeGaps.length > 0) {
    lines.push('**Knowledge Gaps Identified:**');
    for (const gap of analytics.knowledgeGaps.slice(0, 3)) {
      lines.push(`- ${gap.topic}: ${gap.questionCount} questions need better answers`);
    }
  }

  return lines.join('\n');
}
