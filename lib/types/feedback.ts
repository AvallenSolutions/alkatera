/**
 * Feedback & Bug Reporting System Types
 */

export type FeedbackCategory = 'bug' | 'feature' | 'improvement' | 'other';
export type FeedbackPriority = 'low' | 'medium' | 'high' | 'critical';
export type FeedbackStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface FeedbackAttachment {
  path: string;
  name: string;
  size: number;
  type: string;
  url?: string;
}

export interface FeedbackTicket {
  id: string;
  organization_id: string;
  created_by: string;
  title: string;
  description: string;
  category: FeedbackCategory;
  priority: FeedbackPriority;
  status: FeedbackStatus;
  assigned_to: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  attachments: FeedbackAttachment[];
  browser_info: string | null;
  page_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FeedbackTicketWithUser extends FeedbackTicket {
  creator_name: string | null;
  creator_email: string | null;
  organization_name: string | null;
  unread_user_messages: number;
  last_message_at: string | null;
}

export interface FeedbackMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  is_admin_reply: boolean;
  attachments: FeedbackAttachment[];
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface FeedbackMessageWithSender extends FeedbackMessage {
  sender_name?: string;
  sender_email?: string;
  sender_avatar_url?: string;
}

// Form types
export interface CreateTicketInput {
  title: string;
  description: string;
  category: FeedbackCategory;
  priority?: FeedbackPriority;
  attachments?: File[];
  browser_info?: string;
  page_url?: string;
}

export interface CreateMessageInput {
  ticket_id: string;
  message: string;
  attachments?: File[];
  is_admin_reply?: boolean;
}

export interface UpdateTicketInput {
  status?: FeedbackStatus;
  priority?: FeedbackPriority;
  assigned_to?: string | null;
  resolution_notes?: string;
}

// Category metadata
export const FEEDBACK_CATEGORIES: Record<FeedbackCategory, { label: string; description: string; icon: string }> = {
  bug: {
    label: 'Bug Report',
    description: 'Report something that is not working correctly',
    icon: 'Bug',
  },
  feature: {
    label: 'Feature Request',
    description: 'Suggest a new feature or capability',
    icon: 'Lightbulb',
  },
  improvement: {
    label: 'Improvement',
    description: 'Suggest improvements to existing features',
    icon: 'TrendingUp',
  },
  other: {
    label: 'Other',
    description: 'General feedback or questions',
    icon: 'MessageSquare',
  },
};

export const FEEDBACK_PRIORITIES: Record<FeedbackPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'slate' },
  medium: { label: 'Medium', color: 'blue' },
  high: { label: 'High', color: 'amber' },
  critical: { label: 'Critical', color: 'red' },
};

export const FEEDBACK_STATUSES: Record<FeedbackStatus, { label: string; color: string }> = {
  open: { label: 'Open', color: 'blue' },
  in_progress: { label: 'In Progress', color: 'amber' },
  resolved: { label: 'Resolved', color: 'green' },
  closed: { label: 'Closed', color: 'slate' },
};
