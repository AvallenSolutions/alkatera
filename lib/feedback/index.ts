/**
 * Feedback & Bug Reporting Client Library
 */

import { supabase } from '@/lib/supabaseClient';
import type {
  FeedbackTicket,
  FeedbackTicketWithUser,
  FeedbackMessage,
  FeedbackMessageWithSender,
  FeedbackAttachment,
  CreateTicketInput,
  CreateMessageInput,
  UpdateTicketInput,
  FeedbackStatus,
  FeedbackCategory,
} from '@/lib/types/feedback';

// ============================================================================
// Ticket Operations
// ============================================================================

/**
 * Fetch all tickets for the current user's organization
 */
export async function fetchUserTickets(): Promise<FeedbackTicket[]> {
  const { data, error } = await supabase
    .from('feedback_tickets')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching tickets:', error);
    throw error;
  }

  return data || [];
}

/**
 * Fetch all tickets (admin view with user info)
 */
export async function fetchAllTickets(filters?: {
  status?: FeedbackStatus;
  category?: FeedbackCategory;
}): Promise<FeedbackTicketWithUser[]> {
  let query = supabase
    .from('feedback_tickets_with_users')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.category) {
    query = query.eq('category', filters.category);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching all tickets:', error);
    throw error;
  }

  return data || [];
}

/**
 * Fetch a single ticket by ID
 */
export async function fetchTicket(ticketId: string): Promise<FeedbackTicket | null> {
  const { data, error } = await supabase
    .from('feedback_tickets')
    .select('*')
    .eq('id', ticketId)
    .single();

  if (error) {
    console.error('Error fetching ticket:', error);
    return null;
  }

  return data;
}

/**
 * Fetch a single ticket with user info (admin view)
 */
export async function fetchTicketWithUser(ticketId: string): Promise<FeedbackTicketWithUser | null> {
  const { data, error } = await supabase
    .from('feedback_tickets_with_users')
    .select('*')
    .eq('id', ticketId)
    .single();

  if (error) {
    console.error('Error fetching ticket with user:', error);
    return null;
  }

  return data;
}

/**
 * Create a new ticket
 */
export async function createTicket(
  organizationId: string,
  input: CreateTicketInput
): Promise<FeedbackTicket> {
  // Upload attachments first if any
  const attachments: FeedbackAttachment[] = [];
  if (input.attachments && input.attachments.length > 0) {
    for (const file of input.attachments) {
      const attachment = await uploadAttachment(organizationId, file);
      attachments.push(attachment);
    }
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('feedback_tickets')
    .insert({
      organization_id: organizationId,
      created_by: userData.user.id,
      title: input.title,
      description: input.description,
      category: input.category,
      priority: input.priority || 'medium',
      attachments,
      browser_info: input.browser_info,
      page_url: input.page_url,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating ticket:', error);
    throw error;
  }

  return data;
}

/**
 * Update a ticket
 */
export async function updateTicket(
  ticketId: string,
  input: UpdateTicketInput
): Promise<FeedbackTicket> {
  const updateData: Record<string, unknown> = {};

  if (input.status !== undefined) {
    updateData.status = input.status;
    if (input.status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
    }
  }
  if (input.priority !== undefined) updateData.priority = input.priority;
  if (input.assigned_to !== undefined) updateData.assigned_to = input.assigned_to;
  if (input.resolution_notes !== undefined) updateData.resolution_notes = input.resolution_notes;

  const { data, error } = await supabase
    .from('feedback_tickets')
    .update(updateData)
    .eq('id', ticketId)
    .select()
    .single();

  if (error) {
    console.error('Error updating ticket:', error);
    throw error;
  }

  // Notify user when status changes (fire-and-forget)
  if (input.status !== undefined) {
    sendFeedbackEmail(ticketId, 'ticket_updated').catch((err) => {
      console.error('[Feedback] Email notification failed:', err);
    });
  }

  return data;
}

// ============================================================================
// Message Operations
// ============================================================================

/**
 * Fetch messages for a ticket
 */
export async function fetchMessages(ticketId: string): Promise<FeedbackMessageWithSender[]> {
  const { data, error } = await supabase
    .from('feedback_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    throw error;
  }

  if (!data || data.length === 0) return [];

  // Fetch sender profiles separately since sender_id references auth.users, not profiles
  const senderIds = Array.from(new Set(data.map((msg: any) => msg.sender_id)));
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url')
    .in('id', senderIds);

  const profileMap = new Map(
    (profiles || []).map((p: any) => [p.id, p])
  );

  return data.map((msg: any) => {
    const profile = profileMap.get(msg.sender_id);
    return {
      ...msg,
      sender_name: profile?.full_name,
      sender_email: profile?.email,
      sender_avatar_url: profile?.avatar_url,
    };
  });
}

/**
 * Create a new message
 */
export async function createMessage(input: CreateMessageInput): Promise<FeedbackMessage> {
  // Get organization ID from ticket for attachment upload
  const ticket = await fetchTicket(input.ticket_id);
  if (!ticket) {
    throw new Error('Ticket not found');
  }

  // Upload attachments first if any
  const attachments: FeedbackAttachment[] = [];
  if (input.attachments && input.attachments.length > 0) {
    for (const file of input.attachments) {
      const attachment = await uploadAttachment(ticket.organization_id, file);
      attachments.push(attachment);
    }
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('feedback_messages')
    .insert({
      ticket_id: input.ticket_id,
      sender_id: userData.user.id,
      message: input.message,
      is_admin_reply: input.is_admin_reply || false,
      attachments,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating message:', error);
    throw error;
  }

  // Send email notification via edge function (fire-and-forget)
  const eventType = input.is_admin_reply ? 'admin_reply' : 'user_reply';
  sendFeedbackEmail(input.ticket_id, eventType, data.id).catch((err) => {
    console.error('[Feedback] Email notification failed:', err);
  });

  return data;
}

/**
 * Mark messages as read
 */
export async function markMessagesAsRead(ticketId: string, isAdmin: boolean): Promise<void> {
  // If admin, mark user messages as read. If user, mark admin messages as read.
  const { error } = await supabase
    .from('feedback_messages')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('ticket_id', ticketId)
    .eq('is_admin_reply', !isAdmin)
    .eq('is_read', false);

  if (error) {
    console.error('Error marking messages as read:', error);
  }
}

/**
 * Fetch count of unread admin replies across all of the user's tickets.
 * Used for sidebar badges and notification indicators.
 */
export async function fetchUnreadReplyCount(): Promise<number> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return 0;

  // Get all tickets created by this user
  const { data: tickets, error: ticketsError } = await supabase
    .from('feedback_tickets')
    .select('id')
    .eq('created_by', userData.user.id);

  if (ticketsError || !tickets || tickets.length === 0) return 0;

  const ticketIds = tickets.map((t) => t.id);

  // Count unread admin replies
  const { count, error } = await supabase
    .from('feedback_messages')
    .select('id', { count: 'exact', head: true })
    .in('ticket_id', ticketIds)
    .eq('is_admin_reply', true)
    .eq('is_read', false);

  if (error) {
    console.error('Error fetching unread reply count:', error);
    return 0;
  }

  return count || 0;
}

// ============================================================================
// Email Notifications
// ============================================================================

/**
 * Send feedback email notification via Supabase Edge Function.
 * Fire-and-forget — errors are logged but never thrown to callers.
 */
export async function sendFeedbackEmail(
  ticketId: string,
  eventType: 'ticket_created' | 'ticket_updated' | 'admin_reply' | 'user_reply' | 'escalated',
  messageId?: string
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.functions.invoke('send-feedback-email', {
      body: { ticketId, eventType, messageId },
    });

    if (error) {
      console.error('[Feedback] Email edge function error:', error);
    }
  } catch (err) {
    console.error('[Feedback] Failed to invoke email function:', err);
  }
}

// ============================================================================
// Attachment Operations
// ============================================================================

/**
 * Upload an attachment to storage
 */
export async function uploadAttachment(
  organizationId: string,
  file: File
): Promise<FeedbackAttachment> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${organizationId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('feedback-attachments')
    .upload(filePath, file);

  if (uploadError) {
    console.error('Error uploading attachment:', uploadError);
    throw uploadError;
  }

  // Use signed URL since the bucket is private
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('feedback-attachments')
    .createSignedUrl(filePath, 3600); // 1 hour expiry

  if (signedUrlError) {
    console.error('Error creating signed URL:', signedUrlError);
    // Fall back to path - components will generate signed URLs when displaying
  }

  return {
    path: filePath,
    name: file.name,
    size: file.size,
    type: file.type,
    url: signedUrlData?.signedUrl || filePath,
  };
}

/**
 * Get signed URL for a private attachment
 */
export async function getAttachmentUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('feedback-attachments')
    .createSignedUrl(path, 3600); // 1 hour expiry

  if (error) {
    console.error('Error getting attachment URL:', error);
    return null;
  }

  return data.signedUrl;
}

// ============================================================================
// Statistics (Admin)
// ============================================================================

/**
 * Get ticket statistics for admin dashboard
 */
export async function getTicketStats(): Promise<{
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  bugs: number;
  features: number;
  unreadMessages: number;
}> {
  const { data, error } = await supabase
    .from('feedback_tickets_with_users')
    .select('status, category, unread_user_messages');

  if (error) {
    console.error('Error fetching ticket stats:', error);
    return {
      total: 0,
      open: 0,
      inProgress: 0,
      resolved: 0,
      bugs: 0,
      features: 0,
      unreadMessages: 0,
    };
  }

  const tickets = data || [];
  return {
    total: tickets.length,
    open: tickets.filter((t) => t.status === 'open').length,
    inProgress: tickets.filter((t) => t.status === 'in_progress').length,
    resolved: tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length,
    bugs: tickets.filter((t) => t.category === 'bug').length,
    features: tickets.filter((t) => t.category === 'feature').length,
    unreadMessages: tickets.reduce((sum, t) => sum + (t.unread_user_messages || 0), 0),
  };
}

// ============================================================================
// Browser Info Helper
// ============================================================================

/**
 * Get browser/device info for bug reports
 */
export function getBrowserInfo(): string {
  if (typeof window === 'undefined') return 'Unknown';

  const ua = navigator.userAgent;
  const platform = navigator.platform;
  const screenSize = `${window.screen.width}x${window.screen.height}`;
  const viewportSize = `${window.innerWidth}x${window.innerHeight}`;

  return `UA: ${ua}\nPlatform: ${platform}\nScreen: ${screenSize}\nViewport: ${viewportSize}`;
}
