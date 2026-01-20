// Gaia Digital Assistant - Main Client Library
// Handles CRUD operations for Gaia conversations, messages, and feedback
//
// IMPORTANT: Never refer to Gaia as "AI" or "AI agent" in any user-facing text.
// Use "digital assistant", "sustainability guide", or simply "Gaia".

import { supabase } from '@/lib/supabaseClient';
import type {
  GaiaConversation,
  GaiaMessage,
  GaiaConversationWithMessages,
  GaiaKnowledgeEntry,
  GaiaKnowledgeEntryInput,
  GaiaFeedback,
  GaiaFeedbackWithMessage,
  GaiaFeedbackRating,
  GaiaAdminStats,
  GaiaQueryRequest,
  GaiaQueryResponse,
} from '@/lib/types/gaia';

// Re-export types
export * from '@/lib/types/gaia';

// Re-export from system-prompt
export {
  GAIA_PERSONA,
  GAIA_SYSTEM_PROMPT,
  GAIA_SUGGESTED_QUESTIONS,
  GAIA_CONTEXT_TEMPLATE,
  getContextualFollowUps,
  buildContextualPrompt,
  generateContextualSuggestions,
} from './system-prompt';

// Re-export from action-handlers
export {
  GaiaActionHandler,
  getActionHandler,
  parseActionsFromResponse,
  resolveNavigationPath,
  getPageName,
  getNavigationSuggestions,
} from './action-handlers';

// Re-export from knowledge
export {
  COMMON_WORKFLOWS,
  getWorkflow,
  findWorkflow,
  getAllWorkflows,
  formatWorkflowSteps,
} from './knowledge';

// ============================================================================
// Conversation Operations
// ============================================================================

/**
 * Get all conversations for the current user
 */
export async function getConversations(
  organizationId: string
): Promise<GaiaConversation[]> {
  const { data, error } = await supabase
    .from('gaia_conversations')
    .select('*')
    .eq('organization_id', organizationId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get a single conversation with all its messages
 */
export async function getConversationWithMessages(
  conversationId: string
): Promise<GaiaConversationWithMessages | null> {
  const { data: conversation, error: convError } = await supabase
    .from('gaia_conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (convError) throw convError;
  if (!conversation) return null;

  const { data: messages, error: msgError } = await supabase
    .from('gaia_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (msgError) throw msgError;

  return {
    ...conversation,
    messages: messages || [],
  };
}

/**
 * Create a new conversation
 */
export async function createConversation(
  organizationId: string,
  userId: string,
  title?: string
): Promise<GaiaConversation> {
  const { data, error } = await supabase
    .from('gaia_conversations')
    .insert({
      organization_id: organizationId,
      user_id: userId,
      title: title || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update conversation title
 */
export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<void> {
  const { error } = await supabase
    .from('gaia_conversations')
    .update({ title })
    .eq('id', conversationId);

  if (error) throw error;
}

/**
 * Delete a conversation
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('gaia_conversations')
    .delete()
    .eq('id', conversationId);

  if (error) throw error;
}

/**
 * Export a conversation as markdown
 */
export async function exportConversationAsMarkdown(
  conversationId: string
): Promise<string> {
  const conversation = await getConversationWithMessages(conversationId);
  if (!conversation) throw new Error('Conversation not found');

  const lines: string[] = [];
  lines.push(`# Gaia Conversation Export`);
  lines.push(`**Title:** ${conversation.title || 'Untitled conversation'}`);
  lines.push(`**Date:** ${new Date(conversation.created_at).toLocaleDateString()}`);
  lines.push(`**Messages:** ${conversation.messages.length}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const msg of conversation.messages) {
    const timestamp = new Date(msg.created_at).toLocaleString();
    if (msg.role === 'user') {
      lines.push(`## User (${timestamp})`);
    } else {
      lines.push(`## Gaia (${timestamp})`);
    }
    lines.push('');
    lines.push(msg.content);
    lines.push('');

    if (msg.data_sources && msg.data_sources.length > 0) {
      lines.push('**Data Sources:** ' + msg.data_sources.map(s => s.description).join(', '));
      lines.push('');
    }
  }

  lines.push('---');
  lines.push(`*Exported from AlkaTera on ${new Date().toLocaleString()}*`);

  return lines.join('\n');
}

/**
 * Export a conversation as JSON
 */
export async function exportConversationAsJson(
  conversationId: string
): Promise<object> {
  const conversation = await getConversationWithMessages(conversationId);
  if (!conversation) throw new Error('Conversation not found');

  return {
    exportedAt: new Date().toISOString(),
    conversation: {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
      messageCount: conversation.messages.length,
    },
    messages: conversation.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.created_at,
      chartData: msg.chart_data,
      dataSources: msg.data_sources,
    })),
  };
}

// ============================================================================
// Message Operations
// ============================================================================

/**
 * Add a message to a conversation
 */
export async function addMessage(
  conversationId: string,
  message: {
    role: 'user' | 'assistant';
    content: string;
    chart_data?: unknown;
    data_sources?: unknown[];
    tokens_used?: number;
    processing_time_ms?: number;
  }
): Promise<GaiaMessage> {
  const { data, error } = await supabase
    .from('gaia_messages')
    .insert({
      conversation_id: conversationId,
      role: message.role,
      content: message.content,
      chart_data: message.chart_data || null,
      data_sources: message.data_sources || [],
      tokens_used: message.tokens_used,
      processing_time_ms: message.processing_time_ms,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// Query Operations
// ============================================================================

/**
 * Send a query to Gaia
 */
export async function sendGaiaQuery(
  request: GaiaQueryRequest
): Promise<GaiaQueryResponse> {
  const { data, error } = await supabase.functions.invoke('gaia-query', {
    body: request,
  });

  if (error) throw error;
  return data;
}

/**
 * Stream chunk type for Gaia streaming responses
 */
export interface GaiaStreamEvent {
  type: 'start' | 'text' | 'chart' | 'sources' | 'done' | 'error';
  content?: string;
  conversation_id?: string;
  is_new_conversation?: boolean;
  chart_data?: unknown;
  data_sources?: unknown[];
  message_id?: string;
  processing_time_ms?: number;
  error?: string;
}

/**
 * Send a streaming query to Gaia
 * Returns an async generator that yields stream events
 */
export async function* sendGaiaQueryStream(
  request: GaiaQueryRequest
): AsyncGenerator<GaiaStreamEvent> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('Supabase URL not configured');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/gaia-query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ ...request, stream: true }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE events
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const eventBlock of lines) {
        if (eventBlock.startsWith('data: ')) {
          const jsonStr = eventBlock.slice(6);
          try {
            const event: GaiaStreamEvent = JSON.parse(jsonStr);
            yield event;
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }

    // Process any remaining buffer
    if (buffer.startsWith('data: ')) {
      const jsonStr = buffer.slice(6);
      try {
        const event: GaiaStreamEvent = JSON.parse(jsonStr);
        yield event;
      } catch {
        // Skip invalid JSON
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ============================================================================
// Feedback Operations
// ============================================================================

/**
 * Submit feedback on a Gaia response (with duplicate prevention)
 */
export async function submitFeedback(
  messageId: string,
  organizationId: string,
  rating: GaiaFeedbackRating,
  feedbackText?: string
): Promise<GaiaFeedback> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Check for existing feedback (duplicate prevention)
  const { data: existing } = await supabase
    .from('gaia_feedback')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    throw new Error('Feedback already submitted for this message');
  }

  const { data, error } = await supabase
    .from('gaia_feedback')
    .insert({
      message_id: messageId,
      user_id: user.id,
      organization_id: organizationId,
      rating,
      feedback_text: feedbackText,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Check if user has already submitted feedback for a message
 */
export async function hasSubmittedFeedback(messageId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('gaia_feedback')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

// ============================================================================
// Knowledge Base Operations (Admin)
// ============================================================================

/**
 * Get all knowledge base entries
 */
export async function getKnowledgeBase(): Promise<GaiaKnowledgeEntry[]> {
  const { data, error } = await supabase
    .from('gaia_knowledge_base')
    .select('*')
    .order('priority', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get active knowledge base entries (for use in prompts)
 */
export async function getActiveKnowledgeBase(): Promise<GaiaKnowledgeEntry[]> {
  const { data, error } = await supabase
    .from('gaia_knowledge_base')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Create a knowledge base entry
 */
export async function createKnowledgeEntry(
  entry: GaiaKnowledgeEntryInput
): Promise<GaiaKnowledgeEntry> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('gaia_knowledge_base')
    .insert({
      ...entry,
      created_by: user?.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a knowledge base entry
 */
export async function updateKnowledgeEntry(
  id: string,
  updates: Partial<GaiaKnowledgeEntryInput>
): Promise<GaiaKnowledgeEntry> {
  const { data, error } = await supabase
    .from('gaia_knowledge_base')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a knowledge base entry
 */
export async function deleteKnowledgeEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from('gaia_knowledge_base')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================================================
// Admin Analytics Operations
// ============================================================================

/**
 * Get admin stats for Gaia dashboard
 */
export async function getAdminStats(): Promise<GaiaAdminStats> {
  // Get conversation stats
  const { count: totalConversations } = await supabase
    .from('gaia_conversations')
    .select('*', { count: 'exact', head: true });

  // Get message stats
  const { count: totalMessages } = await supabase
    .from('gaia_messages')
    .select('*', { count: 'exact', head: true });

  // Get unique active users (had conversation in last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: activeUsers } = await supabase
    .from('gaia_conversations')
    .select('user_id')
    .gte('updated_at', thirtyDaysAgo.toISOString());

  const uniqueActiveUsers = new Set(activeUsers?.map((u) => u.user_id)).size;

  // Get feedback stats
  const { data: feedback } = await supabase
    .from('gaia_feedback')
    .select('rating');

  const positiveFeedback = feedback?.filter((f) => f.rating === 'positive').length || 0;
  const totalFeedback = feedback?.length || 0;
  const positiveRate = totalFeedback > 0 ? (positiveFeedback / totalFeedback) * 100 : 0;

  // Get pending review count
  const { count: pendingReview } = await supabase
    .from('gaia_feedback')
    .select('*', { count: 'exact', head: true })
    .is('reviewed_at', null);

  // Get knowledge entries count
  const { count: knowledgeEntries } = await supabase
    .from('gaia_knowledge_base')
    .select('*', { count: 'exact', head: true });

  // Get average response time from recent messages
  const { data: recentMessages } = await supabase
    .from('gaia_messages')
    .select('processing_time_ms')
    .eq('role', 'assistant')
    .not('processing_time_ms', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100);

  const avgResponseTime =
    recentMessages && recentMessages.length > 0
      ? recentMessages.reduce((sum, m) => sum + (m.processing_time_ms || 0), 0) /
        recentMessages.length
      : 0;

  return {
    total_conversations: totalConversations || 0,
    total_messages: totalMessages || 0,
    active_users: uniqueActiveUsers,
    positive_feedback_rate: positiveRate,
    avg_response_time_ms: avgResponseTime,
    top_questions: [], // Would need aggregation query
    feedback_pending_review: pendingReview || 0,
    knowledge_entries: knowledgeEntries || 0,
  };
}

/**
 * Get all feedback for admin review
 */
export async function getAllFeedback(): Promise<GaiaFeedbackWithMessage[]> {
  // First fetch feedback with messages
  const { data: feedbackData, error: feedbackError } = await supabase
    .from('gaia_feedback')
    .select(`
      *,
      message:gaia_messages(*)
    `)
    .order('created_at', { ascending: false });

  if (feedbackError) throw feedbackError;

  if (!feedbackData || feedbackData.length === 0) {
    return [];
  }

  // Get unique conversation IDs from messages
  const conversationIds = Array.from(new Set(
    feedbackData
      .filter(f => f.message?.conversation_id)
      .map(f => f.message.conversation_id)
  ));

  // Fetch conversations separately if we have any
  let conversationsMap: Record<string, unknown> = {};
  if (conversationIds.length > 0) {
    const { data: conversations } = await supabase
      .from('gaia_conversations')
      .select('*')
      .in('id', conversationIds);

    if (conversations) {
      conversationsMap = conversations.reduce((acc, conv) => {
        acc[conv.id] = conv;
        return acc;
      }, {} as Record<string, unknown>);
    }
  }

  // Transform the data
  return feedbackData.map((item) => ({
    ...item,
    message: item.message,
    conversation: item.message?.conversation_id
      ? conversationsMap[item.message.conversation_id] || {}
      : {},
  }));
}

/**
 * Mark feedback as reviewed
 */
export async function markFeedbackReviewed(
  feedbackId: string,
  adminNotes?: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('gaia_feedback')
    .update({
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
      admin_notes: adminNotes,
    })
    .eq('id', feedbackId);

  if (error) throw error;
}
