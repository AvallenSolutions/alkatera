/*
  # Create Gaia AI Agent System

  1. New Table: `gaia_conversations`
    - Stores conversation sessions per user/organization
    - Persists across sessions

  2. New Table: `gaia_messages`
    - Individual messages in conversations
    - Includes chart data for visualizations

  3. New Table: `gaia_knowledge_base`
    - Admin-managed knowledge entries to improve Gaia

  4. New Table: `gaia_feedback`
    - User feedback on Gaia responses

  5. New Table: `gaia_analytics`
    - Aggregated analytics for admin dashboard

  6. Security
    - RLS policies for user and admin access
*/

-- ============================================================================
-- STEP 1: Create gaia_conversations table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.gaia_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Conversation metadata
  title TEXT, -- Auto-generated from first message or set by user

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Message count cache
  message_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_gaia_conversations_org_id
ON public.gaia_conversations(organization_id);

CREATE INDEX IF NOT EXISTS idx_gaia_conversations_user_id
ON public.gaia_conversations(user_id);

CREATE INDEX IF NOT EXISTS idx_gaia_conversations_updated_at
ON public.gaia_conversations(updated_at DESC);

-- Create trigger for updated_at
CREATE TRIGGER update_gaia_conversations_updated_at
BEFORE UPDATE ON public.gaia_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.gaia_conversations IS 'Gaia AI conversation sessions per user';

-- ============================================================================
-- STEP 2: Create gaia_messages table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.gaia_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.gaia_conversations(id) ON DELETE CASCADE,

  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,

  -- Visualization data (for charts/tables)
  chart_data JSONB, -- { type: 'bar'|'pie'|'line'|'table', data: {...}, config: {...} }

  -- Data sources referenced
  data_sources JSONB DEFAULT '[]'::jsonb, -- Array of { table, description }

  -- Processing metadata
  tokens_used INTEGER,
  processing_time_ms INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_gaia_messages_conversation_id
ON public.gaia_messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_gaia_messages_created_at
ON public.gaia_messages(created_at);

-- Add comments
COMMENT ON TABLE public.gaia_messages IS 'Individual messages in Gaia conversations';
COMMENT ON COLUMN public.gaia_messages.chart_data IS 'JSON data for rendering charts/tables in responses';
COMMENT ON COLUMN public.gaia_messages.data_sources IS 'Array of data sources referenced in this response';

-- ============================================================================
-- STEP 3: Create gaia_knowledge_base table (Admin-managed)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.gaia_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Entry type
  entry_type TEXT NOT NULL CHECK (entry_type IN ('instruction', 'example_qa', 'definition', 'guideline')),

  -- Content
  title TEXT NOT NULL,
  content TEXT NOT NULL,

  -- For example_qa type
  example_question TEXT,
  example_answer TEXT,

  -- Categorization
  category TEXT, -- e.g., 'emissions', 'water', 'products', 'general'
  tags TEXT[] DEFAULT '{}',

  -- Status
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- Higher = more important

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_gaia_knowledge_base_type
ON public.gaia_knowledge_base(entry_type);

CREATE INDEX IF NOT EXISTS idx_gaia_knowledge_base_category
ON public.gaia_knowledge_base(category);

CREATE INDEX IF NOT EXISTS idx_gaia_knowledge_base_active
ON public.gaia_knowledge_base(is_active) WHERE is_active = true;

-- Create trigger for updated_at
CREATE TRIGGER update_gaia_knowledge_base_updated_at
BEFORE UPDATE ON public.gaia_knowledge_base
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.gaia_knowledge_base IS 'Admin-managed knowledge entries to improve Gaia responses';

-- ============================================================================
-- STEP 4: Create gaia_feedback table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.gaia_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.gaia_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Feedback
  rating TEXT NOT NULL CHECK (rating IN ('positive', 'negative')),
  feedback_text TEXT,

  -- Admin review
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_gaia_feedback_message_id
ON public.gaia_feedback(message_id);

CREATE INDEX IF NOT EXISTS idx_gaia_feedback_rating
ON public.gaia_feedback(rating);

CREATE INDEX IF NOT EXISTS idx_gaia_feedback_reviewed
ON public.gaia_feedback(reviewed_at) WHERE reviewed_at IS NULL;

-- Add comments
COMMENT ON TABLE public.gaia_feedback IS 'User feedback on Gaia responses';

-- ============================================================================
-- STEP 5: Create gaia_analytics table (Aggregated daily)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.gaia_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,

  -- Conversation metrics
  total_conversations INTEGER DEFAULT 0,
  new_conversations INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  user_messages INTEGER DEFAULT 0,
  assistant_messages INTEGER DEFAULT 0,

  -- Feedback metrics
  positive_feedback INTEGER DEFAULT 0,
  negative_feedback INTEGER DEFAULT 0,

  -- Performance metrics
  avg_response_time_ms NUMERIC,
  avg_tokens_per_response NUMERIC,

  -- Top questions (for analytics)
  top_questions JSONB DEFAULT '[]'::jsonb,

  -- By category breakdown
  questions_by_category JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_gaia_analytics_date
ON public.gaia_analytics(date DESC);

-- Create trigger for updated_at
CREATE TRIGGER update_gaia_analytics_updated_at
BEFORE UPDATE ON public.gaia_analytics
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.gaia_analytics IS 'Aggregated daily analytics for Gaia admin dashboard';

-- ============================================================================
-- STEP 6: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.gaia_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gaia_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gaia_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gaia_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gaia_analytics ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 7: RLS Policies for gaia_conversations
-- ============================================================================

-- Users can view their own conversations
CREATE POLICY "Users can view their own conversations"
ON public.gaia_conversations
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can create conversations
CREATE POLICY "Users can create conversations"
ON public.gaia_conversations
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = gaia_conversations.organization_id
    AND om.user_id = auth.uid()
  )
);

-- Users can update their own conversations
CREATE POLICY "Users can update their own conversations"
ON public.gaia_conversations
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete their own conversations
CREATE POLICY "Users can delete their own conversations"
ON public.gaia_conversations
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Alkatera admins can view all conversations
CREATE POLICY "Alkatera admins can view all conversations"
ON public.gaia_conversations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.is_alkatera_admin = true
  )
);

-- ============================================================================
-- STEP 8: RLS Policies for gaia_messages
-- ============================================================================

-- Users can view messages in their conversations
CREATE POLICY "Users can view messages in their conversations"
ON public.gaia_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.gaia_conversations gc
    WHERE gc.id = gaia_messages.conversation_id
    AND gc.user_id = auth.uid()
  )
);

-- Users can create messages in their conversations
CREATE POLICY "Users can create messages in their conversations"
ON public.gaia_messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.gaia_conversations gc
    WHERE gc.id = gaia_messages.conversation_id
    AND gc.user_id = auth.uid()
  )
);

-- Alkatera admins can view all messages
CREATE POLICY "Alkatera admins can view all messages"
ON public.gaia_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.is_alkatera_admin = true
  )
);

-- ============================================================================
-- STEP 9: RLS Policies for gaia_knowledge_base
-- ============================================================================

-- Everyone can read active knowledge base entries
CREATE POLICY "Anyone can read active knowledge base"
ON public.gaia_knowledge_base
FOR SELECT
TO authenticated
USING (is_active = true);

-- Only Alkatera admins can manage knowledge base
CREATE POLICY "Alkatera admins can manage knowledge base"
ON public.gaia_knowledge_base
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.is_alkatera_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.is_alkatera_admin = true
  )
);

-- ============================================================================
-- STEP 10: RLS Policies for gaia_feedback
-- ============================================================================

-- Users can view their own feedback
CREATE POLICY "Users can view their own feedback"
ON public.gaia_feedback
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can create feedback
CREATE POLICY "Users can create feedback"
ON public.gaia_feedback
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Alkatera admins can view all feedback
CREATE POLICY "Alkatera admins can view all feedback"
ON public.gaia_feedback
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.is_alkatera_admin = true
  )
);

-- Alkatera admins can update feedback (for review)
CREATE POLICY "Alkatera admins can update feedback"
ON public.gaia_feedback
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.is_alkatera_admin = true
  )
);

-- ============================================================================
-- STEP 11: RLS Policies for gaia_analytics
-- ============================================================================

-- Only Alkatera admins can access analytics
CREATE POLICY "Alkatera admins can access analytics"
ON public.gaia_analytics
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.is_alkatera_admin = true
  )
);

-- ============================================================================
-- STEP 12: Helper function to update conversation stats
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_gaia_conversation_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update message count and last_message_at
  UPDATE public.gaia_conversations
  SET
    message_count = message_count + 1,
    last_message_at = NEW.created_at,
    updated_at = now()
  WHERE id = NEW.conversation_id;

  -- Auto-generate title from first user message if not set
  IF NEW.role = 'user' THEN
    UPDATE public.gaia_conversations
    SET title = LEFT(NEW.content, 100)
    WHERE id = NEW.conversation_id
    AND title IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS on_gaia_message_created ON public.gaia_messages;
CREATE TRIGGER on_gaia_message_created
AFTER INSERT ON public.gaia_messages
FOR EACH ROW EXECUTE FUNCTION public.update_gaia_conversation_stats();

-- ============================================================================
-- STEP 13: Seed initial knowledge base entries
-- ============================================================================

INSERT INTO public.gaia_knowledge_base (entry_type, title, content, category, priority) VALUES
(
  'guideline',
  'Response Format Guidelines',
  'Always structure responses with:
1. Direct answer with key numbers first
2. Supporting breakdown or details
3. Data sources cited
4. Helpful follow-up suggestions

Use markdown tables for comparisons. Use bullet points for lists.',
  'general',
  100
),
(
  'definition',
  'Scope 1 Emissions',
  'Scope 1 emissions are direct greenhouse gas emissions from sources owned or controlled by the organization. This includes:
- Stationary combustion (boilers, furnaces)
- Mobile combustion (company-owned vehicles)
- Process emissions
- Fugitive emissions (refrigerant leaks)',
  'emissions',
  90
),
(
  'definition',
  'Scope 2 Emissions',
  'Scope 2 emissions are indirect emissions from purchased electricity, steam, heating, and cooling consumed by the organization. These are reported using either:
- Location-based method (grid average factors)
- Market-based method (supplier-specific factors)',
  'emissions',
  90
),
(
  'definition',
  'Scope 3 Emissions',
  'Scope 3 emissions are all other indirect emissions in the value chain. The GHG Protocol defines 15 categories:
- Upstream: purchased goods, capital goods, fuel/energy, transportation, waste, business travel, employee commuting, leased assets
- Downstream: transportation, processing, use of sold products, end-of-life, leased assets, franchises, investments',
  'emissions',
  90
),
(
  'definition',
  'Vitality Score',
  'The AlkaTera Vitality Score is a composite sustainability rating (0-100) based on four pillars:
- Climate Score: Carbon emissions and intensity
- Water Score: Water consumption and risk
- Circularity Score: Waste diversion and recycling
- Nature Score: Land use and biodiversity impact

Higher scores indicate better environmental performance.',
  'general',
  85
),
(
  'instruction',
  'Handling Missing Data',
  'When data is incomplete or missing:
1. Clearly state what data IS available
2. Explicitly note what is missing
3. Provide the path to add missing data (e.g., "You can add this in Products > [Product Name] > LCA")
4. Never estimate or guess values',
  'general',
  95
),
(
  'instruction',
  'Data Source Citations',
  'Always cite data sources in responses:
- For emissions: "Source: Fleet activity logs 2024", "Source: Corporate carbon footprint Q1-Q4"
- For water: "Source: Facility water data [Facility Name]"
- For products: "Source: LCA calculation for [Product Name]"
- For suppliers: "Source: Supplier engagement records"',
  'general',
  95
)
ON CONFLICT DO NOTHING;
