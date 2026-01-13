// Gaia AI Agent - Main Client Library
// Handles CRUD operations for Gaia conversations, messages, and feedback

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
export { GAIA_PERSONA, GAIA_SUGGESTED_QUESTIONS } from './system-prompt';

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

// ============================================================================
// Feedback Operations
// ============================================================================

/**
 * Submit feedback on a Gaia response
 */
export async function submitFeedback(
  messageId: string,
  organizationId: string,
  rating: GaiaFeedbackRating,
  feedbackText?: string
): Promise<GaiaFeedback> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

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
  const conversationIds = [...new Set(
    feedbackData
      .filter(f => f.message?.conversation_id)
      .map(f => f.message.conversation_id)
  )];

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
