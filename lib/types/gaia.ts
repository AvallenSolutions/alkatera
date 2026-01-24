// Rosa Digital Assistant Types
// IMPORTANT: Never refer to Rosa as "AI" or "AI agent" in any user-facing text.
// Use "digital assistant", "sustainability guide", or simply "Rosa".

export type RosaMessageRole = 'user' | 'assistant';

export type RosaKnowledgeEntryType = 'instruction' | 'example_qa' | 'definition' | 'guideline';

export type RosaFeedbackRating = 'positive' | 'negative';

export type RosaChartType = 'bar' | 'pie' | 'line' | 'table' | 'area' | 'donut';

export type RosaActionType = 'navigate' | 'highlight' | 'prefill' | 'open_modal' | 'message';

// Chart data structure for visualizations
export interface RosaChartData {
  type: RosaChartType;
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
export interface RosaDataSource {
  table: string;
  description: string;
  recordCount?: number;
}

// Conversation types
export interface RosaConversation {
  id: string;
  organization_id: string;
  user_id: string;
  title: string | null;
  is_active: boolean;
  is_archived: boolean;
  message_count: number;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
}

// Search result type for conversation search
export interface RosaConversationSearchResult {
  conversation_id: string;
  title: string | null;
  is_archived: boolean;
  message_count: number;
  updated_at: string;
  last_message_at: string | null;
  match_type: 'title' | 'message';
  matched_content: string | null;
}

export interface RosaMessage {
  id: string;
  conversation_id: string;
  role: RosaMessageRole;
  content: string;
  chart_data: RosaChartData | null;
  data_sources: RosaDataSource[];
  tokens_used: number | null;
  processing_time_ms: number | null;
  created_at: string;
}

// For the UI - combined conversation with messages
export interface RosaConversationWithMessages extends RosaConversation {
  messages: RosaMessage[];
}

// Knowledge base types
export interface RosaKnowledgeEntry {
  id: string;
  created_by: string | null;
  entry_type: RosaKnowledgeEntryType;
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
export interface RosaKnowledgeEntryInput {
  entry_type: RosaKnowledgeEntryType;
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
export interface RosaFeedback {
  id: string;
  message_id: string;
  user_id: string;
  organization_id: string;
  rating: RosaFeedbackRating;
  feedback_text: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  created_at: string;
}

export interface RosaFeedbackWithMessage extends RosaFeedback {
  message: RosaMessage;
  conversation: RosaConversation;
  user_email?: string;
  organization_name?: string;
}

// Analytics types
export interface RosaAnalytics {
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
export interface RosaQueryRequest {
  message: string;
  conversation_id?: string;
  organization_id: string;
}

export interface RosaQueryResponse {
  message: RosaMessage;
  conversation_id: string;
  is_new_conversation: boolean;
}

// Streaming response chunk
export interface RosaStreamChunk {
  type: 'text' | 'chart' | 'sources' | 'done' | 'error';
  content?: string;
  chart_data?: RosaChartData;
  data_sources?: RosaDataSource[];
  error?: string;
}

// Context types for building Gemini prompts
export interface RosaOrganizationContext {
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
export interface RosaAdminStats {
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
export interface RosaSuggestedQuestion {
  question: string;
  category: string;
  icon?: string;
}

// UI state types
export interface RosaChatState {
  conversations: RosaConversation[];
  activeConversation: RosaConversationWithMessages | null;
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
}

// ============================================================================
// User Context Types (for data entry assistance & platform guidance)
// ============================================================================

/**
 * Data availability information for context-aware suggestions
 */
export interface RosaAvailableData {
  hasProducts: boolean;
  productCount: number;
  hasFacilities: boolean;
  facilityCount: number;
  hasUtilityData: boolean;
  hasProductLCAs: boolean;
  hasIngredients: boolean;
  hasPackaging: boolean;
  hasFleet: boolean;
  fleetCount: number;
  hasSuppliers: boolean;
  supplierCount: number;
}

/**
 * User context for personalized guidance and suggestions
 */
export interface RosaUserContext {
  currentPage?: string;
  currentRoute?: string;
  onboardingProgress?: number;
  userRole?: string;
  companyType?: string[];
  companySize?: string;
  recentActions?: string[];
  availableData?: RosaAvailableData;
  missingData?: string[];
  userGoals?: string[];
}

// ============================================================================
// Action Types (for platform navigation & guidance)
// ============================================================================

/**
 * Navigation action payload
 */
export interface RosaNavigatePayload {
  path: string;
  label?: string;
}

/**
 * Highlight action payload
 */
export interface RosaHighlightPayload {
  selector: string;
  duration?: number;
}

/**
 * Pre-fill action payload
 */
export interface RosaPrefillPayload {
  formId?: string;
  fields: Record<string, string | number | boolean>;
}

/**
 * Modal action payload
 */
export interface RosaModalPayload {
  modalId: string;
  data?: Record<string, unknown>;
}

/**
 * Message action payload
 */
export interface RosaMessagePayload {
  mode?: 'guided' | 'persistent';
  persistent?: boolean;
  message?: string;
}

/**
 * Union type for all action payloads
 */
export type RosaActionPayload =
  | RosaNavigatePayload
  | RosaHighlightPayload
  | RosaPrefillPayload
  | RosaModalPayload
  | RosaMessagePayload;

/**
 * Action that Rosa can suggest/execute
 */
export interface RosaAction {
  type: RosaActionType;
  payload: RosaActionPayload;
}

/**
 * Extended query response with actions
 */
export interface RosaQueryResponseWithActions extends RosaQueryResponse {
  actions?: RosaAction[];
  context?: {
    currentPage?: string;
    suggestions?: string[];
  };
}

// ============================================================================
// Backwards compatibility aliases (Gaia -> Rosa)
// ============================================================================

/** @deprecated Use RosaMessageRole instead */
export type GaiaMessageRole = RosaMessageRole;
/** @deprecated Use RosaKnowledgeEntryType instead */
export type GaiaKnowledgeEntryType = RosaKnowledgeEntryType;
/** @deprecated Use RosaFeedbackRating instead */
export type GaiaFeedbackRating = RosaFeedbackRating;
/** @deprecated Use RosaChartType instead */
export type GaiaChartType = RosaChartType;
/** @deprecated Use RosaActionType instead */
export type GaiaActionType = RosaActionType;
/** @deprecated Use RosaChartData instead */
export type GaiaChartData = RosaChartData;
/** @deprecated Use RosaDataSource instead */
export type GaiaDataSource = RosaDataSource;
/** @deprecated Use RosaConversation instead */
export type GaiaConversation = RosaConversation;
/** @deprecated Use RosaMessage instead */
export type GaiaMessage = RosaMessage;
/** @deprecated Use RosaConversationWithMessages instead */
export type GaiaConversationWithMessages = RosaConversationWithMessages;
/** @deprecated Use RosaKnowledgeEntry instead */
export type GaiaKnowledgeEntry = RosaKnowledgeEntry;
/** @deprecated Use RosaKnowledgeEntryInput instead */
export type GaiaKnowledgeEntryInput = RosaKnowledgeEntryInput;
/** @deprecated Use RosaFeedback instead */
export type GaiaFeedback = RosaFeedback;
/** @deprecated Use RosaFeedbackWithMessage instead */
export type GaiaFeedbackWithMessage = RosaFeedbackWithMessage;
/** @deprecated Use RosaAnalytics instead */
export type GaiaAnalytics = RosaAnalytics;
/** @deprecated Use RosaQueryRequest instead */
export type GaiaQueryRequest = RosaQueryRequest;
/** @deprecated Use RosaQueryResponse instead */
export type GaiaQueryResponse = RosaQueryResponse;
/** @deprecated Use RosaStreamChunk instead */
export type GaiaStreamChunk = RosaStreamChunk;
/** @deprecated Use RosaOrganizationContext instead */
export type GaiaOrganizationContext = RosaOrganizationContext;
/** @deprecated Use RosaAdminStats instead */
export type GaiaAdminStats = RosaAdminStats;
/** @deprecated Use RosaSuggestedQuestion instead */
export type GaiaSuggestedQuestion = RosaSuggestedQuestion;
/** @deprecated Use RosaChatState instead */
export type GaiaChatState = RosaChatState;
/** @deprecated Use RosaAvailableData instead */
export type GaiaAvailableData = RosaAvailableData;
/** @deprecated Use RosaUserContext instead */
export type GaiaUserContext = RosaUserContext;
/** @deprecated Use RosaNavigatePayload instead */
export type GaiaNavigatePayload = RosaNavigatePayload;
/** @deprecated Use RosaHighlightPayload instead */
export type GaiaHighlightPayload = RosaHighlightPayload;
/** @deprecated Use RosaPrefillPayload instead */
export type GaiaPrefillPayload = RosaPrefillPayload;
/** @deprecated Use RosaModalPayload instead */
export type GaiaModalPayload = RosaModalPayload;
/** @deprecated Use RosaMessagePayload instead */
export type GaiaMessagePayload = RosaMessagePayload;
/** @deprecated Use RosaActionPayload instead */
export type GaiaActionPayload = RosaActionPayload;
/** @deprecated Use RosaAction instead */
export type GaiaAction = RosaAction;
/** @deprecated Use RosaQueryResponseWithActions instead */
export type GaiaQueryResponseWithActions = RosaQueryResponseWithActions;
/** @deprecated Use RosaConversationSearchResult instead */
export type GaiaConversationSearchResult = RosaConversationSearchResult;
