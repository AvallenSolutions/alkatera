export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ============================================================================
// Rosa Knowledge Documents
// ============================================================================

export type RosaKnowledgeDocumentCategory =
  | 'ghg_protocol'
  | 'sbti'
  | 'regulations'
  | 'industry_standards'
  | 'best_practices'
  | 'case_studies'
  | 'certifications'
  | 'methodology'
  | 'training'
  | 'other'

export type RosaKnowledgeDocumentStatus =
  | 'pending'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'archived'

export interface RosaKnowledgeDocument {
  id: string
  title: string
  description: string | null
  file_name: string
  file_url: string
  file_type: string
  file_size_bytes: number | null
  category: RosaKnowledgeDocumentCategory
  tags: string[]
  source_name: string | null
  source_url: string | null
  publication_date: string | null
  status: RosaKnowledgeDocumentStatus
  processing_error: string | null
  chunk_count: number
  is_public: boolean
  organization_id: string | null
  uploaded_by: string
  created_at: string
  updated_at: string
  processed_at: string | null
}

export interface RosaKnowledgeDocumentInsert {
  id?: string
  title: string
  description?: string | null
  file_name: string
  file_url: string
  file_type: string
  file_size_bytes?: number | null
  category: RosaKnowledgeDocumentCategory
  tags?: string[]
  source_name?: string | null
  source_url?: string | null
  publication_date?: string | null
  status?: RosaKnowledgeDocumentStatus
  processing_error?: string | null
  chunk_count?: number
  is_public?: boolean
  organization_id?: string | null
  uploaded_by: string
  created_at?: string
  updated_at?: string
  processed_at?: string | null
}

export interface RosaKnowledgeDocumentUpdate {
  id?: string
  title?: string
  description?: string | null
  file_name?: string
  file_url?: string
  file_type?: string
  file_size_bytes?: number | null
  category?: RosaKnowledgeDocumentCategory
  tags?: string[]
  source_name?: string | null
  source_url?: string | null
  publication_date?: string | null
  status?: RosaKnowledgeDocumentStatus
  processing_error?: string | null
  chunk_count?: number
  is_public?: boolean
  organization_id?: string | null
  uploaded_by?: string
  created_at?: string
  updated_at?: string
  processed_at?: string | null
}

// ============================================================================
// Rosa Knowledge Chunks
// ============================================================================

export interface RosaKnowledgeChunk {
  id: string
  document_id: string
  content: string
  chunk_index: number
  section_title: string | null
  page_number: number | null
  embedding: number[] | null
  token_count: number | null
  created_at: string
}

export interface RosaKnowledgeChunkInsert {
  id?: string
  document_id: string
  content: string
  chunk_index: number
  section_title?: string | null
  page_number?: number | null
  embedding?: number[] | null
  token_count?: number | null
  created_at?: string
}

export interface RosaKnowledgeChunkUpdate {
  id?: string
  document_id?: string
  content?: string
  chunk_index?: number
  section_title?: string | null
  page_number?: number | null
  embedding?: number[] | null
  token_count?: number | null
  created_at?: string
}

// ============================================================================
// Rosa Curated Knowledge
// ============================================================================

export type RosaCuratedKnowledgeCategory =
  | 'ghg_protocol'
  | 'sbti'
  | 'csrd'
  | 'tcfd'
  | 'iso_standards'
  | 'water_stewardship'
  | 'circular_economy'
  | 'biodiversity'
  | 'social_sustainability'
  | 'drinks_industry'
  | 'carbon_accounting'
  | 'emission_factors'
  | 'reduction_strategies'
  | 'reporting_frameworks'

export interface RosaCuratedKnowledge {
  id: string
  topic: string
  subtopic: string | null
  content: string
  category: RosaCuratedKnowledgeCategory
  keywords: string[]
  embedding: number[] | null
  source: string | null
  source_url: string | null
  valid_from: string | null
  valid_until: string | null
  is_active: boolean
  priority: number
  created_at: string
  updated_at: string
}

export interface RosaCuratedKnowledgeInsert {
  id?: string
  topic: string
  subtopic?: string | null
  content: string
  category: RosaCuratedKnowledgeCategory
  keywords?: string[]
  embedding?: number[] | null
  source?: string | null
  source_url?: string | null
  valid_from?: string | null
  valid_until?: string | null
  is_active?: boolean
  priority?: number
  created_at?: string
  updated_at?: string
}

export interface RosaCuratedKnowledgeUpdate {
  id?: string
  topic?: string
  subtopic?: string | null
  content?: string
  category?: RosaCuratedKnowledgeCategory
  keywords?: string[]
  embedding?: number[] | null
  source?: string | null
  source_url?: string | null
  valid_from?: string | null
  valid_until?: string | null
  is_active?: boolean
  priority?: number
  created_at?: string
  updated_at?: string
}

// ============================================================================
// Rosa Document Extractions
// ============================================================================

export type RosaDocumentExtractionType =
  | 'utility_bill'
  | 'invoice'
  | 'waste_manifest'
  | 'supplier_report'
  | 'certificate'
  | 'other'

export type RosaDocumentExtractionStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'needs_review'

export interface RosaExtractedField {
  field_name: string
  value: string | number | null
  confidence: number
  mapping_suggestion?: string
  source_location?: string
}

export interface RosaSuggestedAction {
  action_type: 'create' | 'update' | 'link'
  target_table: string
  field_mappings: Record<string, unknown>
  confidence: number
}

export interface RosaDocumentExtraction {
  id: string
  organization_id: string
  user_id: string
  document_type: RosaDocumentExtractionType
  file_name: string
  file_url: string
  status: RosaDocumentExtractionStatus
  extracted_fields: RosaExtractedField[]
  metadata: Record<string, unknown>
  suggested_actions: RosaSuggestedAction[]
  validation_errors: Json | null
  created_at: string
  processed_at: string | null
}

export interface RosaDocumentExtractionInsert {
  id?: string
  organization_id: string
  user_id: string
  document_type: RosaDocumentExtractionType
  file_name: string
  file_url: string
  status?: RosaDocumentExtractionStatus
  extracted_fields?: RosaExtractedField[]
  metadata?: Record<string, unknown>
  suggested_actions?: RosaSuggestedAction[]
  validation_errors?: Json | null
  created_at?: string
  processed_at?: string | null
}

export interface RosaDocumentExtractionUpdate {
  id?: string
  organization_id?: string
  user_id?: string
  document_type?: RosaDocumentExtractionType
  file_name?: string
  file_url?: string
  status?: RosaDocumentExtractionStatus
  extracted_fields?: RosaExtractedField[]
  metadata?: Record<string, unknown>
  suggested_actions?: RosaSuggestedAction[]
  validation_errors?: Json | null
  created_at?: string
  processed_at?: string | null
}

// ============================================================================
// Rosa Feedback Patterns
// ============================================================================

export type RosaFeedbackPatternStatus =
  | 'pending_review'
  | 'addressed'
  | 'ignored'

export interface RosaFeedbackPattern {
  id: string
  pattern: string
  pattern_hash: string
  category: string
  positive_count: number
  negative_count: number
  success_rate: number
  last_occurrence: string
  suggested_knowledge_entry: Json | null
  status: RosaFeedbackPatternStatus
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export interface RosaFeedbackPatternInsert {
  id?: string
  pattern: string
  category: string
  positive_count?: number
  negative_count?: number
  last_occurrence?: string
  suggested_knowledge_entry?: Json | null
  status?: RosaFeedbackPatternStatus
  reviewed_by?: string | null
  reviewed_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface RosaFeedbackPatternUpdate {
  id?: string
  pattern?: string
  category?: string
  positive_count?: number
  negative_count?: number
  last_occurrence?: string
  suggested_knowledge_entry?: Json | null
  status?: RosaFeedbackPatternStatus
  reviewed_by?: string | null
  reviewed_at?: string | null
  created_at?: string
  updated_at?: string
}

// ============================================================================
// Search Function Return Type
// ============================================================================

export interface RosaKnowledgeSearchResult {
  id: string
  source_type: 'document' | 'curated'
  document_title: string
  content: string
  category: string
  similarity: number
  source_name: string | null
  section_title: string | null
}

// ============================================================================
// Database Tables Type Map
// ============================================================================

export interface DatabaseTables {
  rosa_knowledge_documents: {
    Row: RosaKnowledgeDocument
    Insert: RosaKnowledgeDocumentInsert
    Update: RosaKnowledgeDocumentUpdate
  }
  rosa_knowledge_chunks: {
    Row: RosaKnowledgeChunk
    Insert: RosaKnowledgeChunkInsert
    Update: RosaKnowledgeChunkUpdate
  }
  rosa_curated_knowledge: {
    Row: RosaCuratedKnowledge
    Insert: RosaCuratedKnowledgeInsert
    Update: RosaCuratedKnowledgeUpdate
  }
  rosa_document_extractions: {
    Row: RosaDocumentExtraction
    Insert: RosaDocumentExtractionInsert
    Update: RosaDocumentExtractionUpdate
  }
  rosa_feedback_patterns: {
    Row: RosaFeedbackPattern
    Insert: RosaFeedbackPatternInsert
    Update: RosaFeedbackPatternUpdate
  }
}

// ============================================================================
// Database Type
// ============================================================================

// Keep Database as 'any' for backwards compatibility with existing code
// The specific Rosa types above can be used directly when needed
export type Database = any

// Typed Database definition for future use when full types are generated
export type TypedDatabase = {
  public: {
    Tables: DatabaseTables & {
      [key: string]: {
        Row: Record<string, unknown>
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
      }
    }
    Functions: {
      search_rosa_knowledge: {
        Args: {
          query_embedding: number[]
          match_threshold?: number
          match_count?: number
          p_categories?: string[] | null
          p_organization_id?: string | null
        }
        Returns: RosaKnowledgeSearchResult[]
      }
      upsert_rosa_feedback_pattern: {
        Args: {
          p_pattern: string
          p_category: string
          p_is_positive: boolean
        }
        Returns: string
      }
    }
  }
}
