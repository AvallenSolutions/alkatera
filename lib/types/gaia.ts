// Gaia AI Agent Types

export type GaiaMessageRole = 'user' | 'assistant';

export type GaiaKnowledgeEntryType = 'instruction' | 'example_qa' | 'definition' | 'guideline';

export type GaiaFeedbackRating = 'positive' | 'negative';

export type GaiaChartType = 'bar' | 'pie' | 'line' | 'table' | 'area' | 'donut';

// Chart data structure for visualizations
export interface GaiaChartData {
  type: GaiaChartType;
  title?: string;
  data: Record<string, unknown>[] | unknown[][];
  config?: {
    xKey?: string;
    yKey?: string;
    labelKey?: string;
    valueKey?: string;
    colors?: string[];
    headers?: string[];
    showLegend?: boolean;
    showGrid?: boolean;
    stacked?: boolean;
  };
}

// Data source reference
export interface GaiaDataSource {
  table: string;
  description: string;
  recordCount?: number;
}

// Conversation types
export interface GaiaConversation {
  id: string;
  organization_id: string;
  user_id: string;
  title: string | null;
  is_active: boolean;
  message_count: number;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
}

export interface GaiaMessage {
  id: string;
  conversation_id: string;
  role: GaiaMessageRole;
  content: string;
  chart_data: GaiaChartData | null;
  data_sources: GaiaDataSource[];
  tokens_used: number | null;
  processing_time_ms: number | null;
  created_at: string;
}

// For the UI - combined conversation with messages
export interface GaiaConversationWithMessages extends GaiaConversation {
  messages: GaiaMessage[];
}

// Knowledge base types
export interface GaiaKnowledgeEntry {
  id: string;
  created_by: string | null;
  entry_type: GaiaKnowledgeEntryType;
  title: string;
  content: string;
  example_question: string | null;
  example_answer: string | null;
  category: string | null;
  tags: string[];
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

// For creating/updating knowledge entries
export interface GaiaKnowledgeEntryInput {
  entry_type: GaiaKnowledgeEntryType;
  title: string;
  content: string;
  example_question?: string;
  example_answer?: string;
  category?: string;
  tags?: string[];
  is_active?: boolean;
  priority?: number;
}

// Feedback types
export interface GaiaFeedback {
  id: string;
  message_id: string;
  user_id: string;
  organization_id: string;
  rating: GaiaFeedbackRating;
  feedback_text: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  created_at: string;
}

export interface GaiaFeedbackWithMessage extends GaiaFeedback {
  message: GaiaMessage;
  conversation: GaiaConversation;
  user_email?: string;
  organization_name?: string;
}

// Analytics types
export interface GaiaAnalytics {
  id: string;
  date: string;
  total_conversations: number;
  new_conversations: number;
  total_messages: number;
  user_messages: number;
  assistant_messages: number;
  positive_feedback: number;
  negative_feedback: number;
  avg_response_time_ms: number | null;
  avg_tokens_per_response: number | null;
  top_questions: { question: string; count: number }[];
  questions_by_category: Record<string, number>;
  created_at: string;
  updated_at: string;
}

// Query request/response types for the Edge Function
export interface GaiaQueryRequest {
  message: string;
  conversation_id?: string;
  organization_id: string;
}

export interface GaiaQueryResponse {
  message: GaiaMessage;
  conversation_id: string;
  is_new_conversation: boolean;
}

// Streaming response chunk
export interface GaiaStreamChunk {
  type: 'text' | 'chart' | 'sources' | 'done' | 'error';
  content?: string;
  chart_data?: GaiaChartData;
  data_sources?: GaiaDataSource[];
  error?: string;
}

// Context types for building Gemini prompts
export interface GaiaOrganizationContext {
  organization: {
    id: string;
    name: string;
    industry?: string;
  };
  emissions_summary?: {
    scope1_total?: number;
    scope2_total?: number;
    scope3_total?: number;
    reporting_year?: number;
  };
  facilities_summary?: {
    count: number;
    total_water_consumption?: number;
    total_energy?: number;
  };
  products_summary?: {
    total_count: number;
    with_lca_count: number;
  };
  fleet_summary?: {
    vehicle_count: number;
    total_distance_km?: number;
    total_emissions?: number;
  };
  vitality_scores?: {
    overall_score?: number;
    climate_score?: number;
    water_score?: number;
    circularity_score?: number;
    nature_score?: number;
  };
}

// Admin dashboard stats
export interface GaiaAdminStats {
  total_conversations: number;
  total_messages: number;
  active_users: number;
  positive_feedback_rate: number;
  avg_response_time_ms: number;
  top_questions: { question: string; count: number }[];
  feedback_pending_review: number;
  knowledge_entries: number;
}

// Suggested questions based on data state
export interface GaiaSuggestedQuestion {
  question: string;
  category: string;
  icon?: string;
}

// UI state types
export interface GaiaChatState {
  conversations: GaiaConversation[];
  activeConversation: GaiaConversationWithMessages | null;
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
}
