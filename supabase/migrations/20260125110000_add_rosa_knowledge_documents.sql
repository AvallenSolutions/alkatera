/*
  # Rosa Knowledge Document System

  This migration adds support for:
  1. Uploaded knowledge documents (PDFs, guides, reports)
  2. Vector embeddings for semantic search (RAG)
  3. Automatic document indexing for Rosa

  ## Tables Created:
  - `rosa_knowledge_documents` - Uploaded document metadata
  - `rosa_knowledge_chunks` - Document chunks with vector embeddings

  ## Features:
  - pgvector extension for similarity search
  - Automatic embedding storage
  - Document categorization and tagging
*/

-- ============================================================================
-- Enable pgvector extension for vector similarity search
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- Knowledge Documents Table (uploaded files)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rosa_knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Document metadata
  title TEXT NOT NULL,
  description TEXT,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL, -- pdf, docx, txt, md, html
  file_size_bytes INTEGER,

  -- Categorization
  category TEXT NOT NULL CHECK (category IN (
    'ghg_protocol',
    'sbti',
    'regulations',
    'industry_standards',
    'best_practices',
    'case_studies',
    'certifications',
    'methodology',
    'training',
    'other'
  )),
  tags TEXT[] DEFAULT '{}',

  -- Source information
  source_name TEXT, -- e.g., "GHG Protocol", "WBCSD", "EPA"
  source_url TEXT,
  publication_date DATE,

  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Waiting to be processed
    'processing',   -- Currently being chunked and embedded
    'ready',        -- Successfully indexed and searchable
    'failed',       -- Processing failed
    'archived'      -- No longer active
  )),
  processing_error TEXT,
  chunk_count INTEGER DEFAULT 0,

  -- Access control
  is_public BOOLEAN NOT NULL DEFAULT true, -- Available to all organizations
  organization_id UUID REFERENCES public.organizations(id), -- If private to one org

  -- Audit
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Indexes for knowledge documents
CREATE INDEX IF NOT EXISTS idx_rosa_knowledge_docs_category ON public.rosa_knowledge_documents(category);
CREATE INDEX IF NOT EXISTS idx_rosa_knowledge_docs_status ON public.rosa_knowledge_documents(status);
CREATE INDEX IF NOT EXISTS idx_rosa_knowledge_docs_tags ON public.rosa_knowledge_documents USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_rosa_knowledge_docs_org ON public.rosa_knowledge_documents(organization_id);

-- ============================================================================
-- Knowledge Chunks Table (with vector embeddings)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rosa_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.rosa_knowledge_documents(id) ON DELETE CASCADE,

  -- Chunk content
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL, -- Order within document

  -- Metadata for context
  section_title TEXT, -- Section/chapter heading if available
  page_number INTEGER, -- Page number if from PDF

  -- Vector embedding (1536 dimensions for OpenAI embeddings, 768 for others)
  embedding vector(1536),

  -- Token count for context budgeting
  token_count INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for knowledge chunks
CREATE INDEX IF NOT EXISTS idx_rosa_knowledge_chunks_doc ON public.rosa_knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_rosa_knowledge_chunks_embedding ON public.rosa_knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- Curated Knowledge Table (pre-loaded expert knowledge)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rosa_curated_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Knowledge content
  topic TEXT NOT NULL,
  subtopic TEXT,
  content TEXT NOT NULL,

  -- Categorization
  category TEXT NOT NULL CHECK (category IN (
    'ghg_protocol',
    'sbti',
    'csrd',
    'tcfd',
    'iso_standards',
    'water_stewardship',
    'circular_economy',
    'biodiversity',
    'social_sustainability',
    'drinks_industry',
    'carbon_accounting',
    'emission_factors',
    'reduction_strategies',
    'reporting_frameworks'
  )),

  -- For search
  keywords TEXT[] DEFAULT '{}',
  embedding vector(1536),

  -- Source and validity
  source TEXT,
  source_url TEXT,
  valid_from DATE,
  valid_until DATE, -- For regulations that expire

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 5, -- 1-10, higher = more important

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for curated knowledge
CREATE INDEX IF NOT EXISTS idx_rosa_curated_knowledge_category ON public.rosa_curated_knowledge(category);
CREATE INDEX IF NOT EXISTS idx_rosa_curated_knowledge_active ON public.rosa_curated_knowledge(is_active);
CREATE INDEX IF NOT EXISTS idx_rosa_curated_knowledge_keywords ON public.rosa_curated_knowledge USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_rosa_curated_knowledge_embedding ON public.rosa_curated_knowledge
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- ============================================================================
-- Semantic Search Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.search_rosa_knowledge(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INTEGER DEFAULT 5,
  p_categories TEXT[] DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  source_type TEXT,
  document_title TEXT,
  content TEXT,
  category TEXT,
  similarity FLOAT,
  source_name TEXT,
  section_title TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  -- Search document chunks
  SELECT
    c.id,
    'document'::TEXT as source_type,
    d.title as document_title,
    c.content,
    d.category,
    1 - (c.embedding <=> query_embedding) as similarity,
    d.source_name,
    c.section_title
  FROM public.rosa_knowledge_chunks c
  JOIN public.rosa_knowledge_documents d ON d.id = c.document_id
  WHERE d.status = 'ready'
    AND (d.is_public = true OR d.organization_id = p_organization_id)
    AND (p_categories IS NULL OR d.category = ANY(p_categories))
    AND 1 - (c.embedding <=> query_embedding) > match_threshold

  UNION ALL

  -- Search curated knowledge
  SELECT
    ck.id,
    'curated'::TEXT as source_type,
    ck.topic as document_title,
    ck.content,
    ck.category,
    1 - (ck.embedding <=> query_embedding) as similarity,
    ck.source as source_name,
    ck.subtopic as section_title
  FROM public.rosa_curated_knowledge ck
  WHERE ck.is_active = true
    AND (p_categories IS NULL OR ck.category = ANY(p_categories))
    AND (ck.valid_until IS NULL OR ck.valid_until >= CURRENT_DATE)
    AND 1 - (ck.embedding <=> query_embedding) > match_threshold

  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_rosa_knowledge TO authenticated;

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE public.rosa_knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rosa_knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rosa_curated_knowledge ENABLE ROW LEVEL SECURITY;

-- Knowledge documents: public ones visible to all, private to org members
CREATE POLICY "Users can view public knowledge documents"
  ON public.rosa_knowledge_documents
  FOR SELECT
  USING (
    is_public = true
    OR organization_id IN (
      SELECT organization_id FROM public.user_organization_roles WHERE user_id = auth.uid()
    )
  );

-- Only Alkatera admins can manage knowledge documents
CREATE POLICY "Alkatera admins can manage knowledge documents"
  ON public.rosa_knowledge_documents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organization_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
      AND organization_id IN (SELECT id FROM public.organizations WHERE name = 'Alkatera')
    )
  );

-- Chunks inherit access from parent document
CREATE POLICY "Users can view knowledge chunks"
  ON public.rosa_knowledge_chunks
  FOR SELECT
  USING (
    document_id IN (
      SELECT id FROM public.rosa_knowledge_documents
      WHERE is_public = true
      OR organization_id IN (
        SELECT organization_id FROM public.user_organization_roles WHERE user_id = auth.uid()
      )
    )
  );

-- Alkatera admins manage chunks
CREATE POLICY "Alkatera admins can manage knowledge chunks"
  ON public.rosa_knowledge_chunks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organization_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
      AND organization_id IN (SELECT id FROM public.organizations WHERE name = 'Alkatera')
    )
  );

-- Curated knowledge visible to all authenticated users
CREATE POLICY "Users can view curated knowledge"
  ON public.rosa_curated_knowledge
  FOR SELECT
  USING (is_active = true);

-- Alkatera admins manage curated knowledge
CREATE POLICY "Alkatera admins can manage curated knowledge"
  ON public.rosa_curated_knowledge
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organization_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
      AND organization_id IN (SELECT id FROM public.organizations WHERE name = 'Alkatera')
    )
  );

-- ============================================================================
-- Trigger to update timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_rosa_knowledge_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rosa_knowledge_documents_timestamp
  BEFORE UPDATE ON public.rosa_knowledge_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_rosa_knowledge_updated_at();

CREATE TRIGGER update_rosa_curated_knowledge_timestamp
  BEFORE UPDATE ON public.rosa_curated_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION update_rosa_knowledge_updated_at();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.rosa_knowledge_documents IS 'Uploaded documents for Rosa knowledge base (PDFs, guides, reports)';
COMMENT ON TABLE public.rosa_knowledge_chunks IS 'Document chunks with vector embeddings for semantic search';
COMMENT ON TABLE public.rosa_curated_knowledge IS 'Pre-loaded curated sustainability knowledge';
COMMENT ON FUNCTION public.search_rosa_knowledge IS 'Semantic search across all Rosa knowledge sources';
