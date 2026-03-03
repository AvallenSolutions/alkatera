-- Migration: Create missing community impact tables and emission_factor_requests
--
-- These tables are referenced by existing API routes and hooks but were never
-- created via migration. This migration creates them all idempotently.

-- ============================================================================
-- 1. community_donations
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.community_donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  donation_name text NOT NULL,
  donation_type text NOT NULL CHECK (donation_type IN ('cash', 'in_kind', 'time', 'pro_bono')),
  description text,
  recipient_name text NOT NULL,
  recipient_type text,
  recipient_registration_number text,
  recipient_cause text,
  donation_amount numeric(12,2),
  currency text NOT NULL DEFAULT 'GBP',
  estimated_value numeric(12,2),
  hours_donated numeric(8,2),
  donation_date date,
  reporting_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  beneficiaries_count integer,
  impact_description text,
  evidence_url text,
  receipt_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_donations_org
  ON public.community_donations(organization_id);
CREATE INDEX IF NOT EXISTS idx_community_donations_year
  ON public.community_donations(reporting_year);

ALTER TABLE public.community_donations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'community_donations' AND policyname = 'org_member_select_donations'
  ) THEN
    CREATE POLICY org_member_select_donations ON public.community_donations
      FOR SELECT USING (
        organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'community_donations' AND policyname = 'org_member_insert_donations'
  ) THEN
    CREATE POLICY org_member_insert_donations ON public.community_donations
      FOR INSERT WITH CHECK (
        organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'community_donations' AND policyname = 'org_member_update_donations'
  ) THEN
    CREATE POLICY org_member_update_donations ON public.community_donations
      FOR UPDATE USING (
        organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'community_donations' AND policyname = 'org_member_delete_donations'
  ) THEN
    CREATE POLICY org_member_delete_donations ON public.community_donations
      FOR DELETE USING (
        organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================================
-- 2. community_volunteer_activities
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.community_volunteer_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  activity_name text NOT NULL,
  activity_type text NOT NULL CHECK (activity_type IN ('team_volunteering', 'individual', 'skills_based', 'board_service')),
  description text,
  partner_organization text,
  partner_cause text,
  activity_date date,
  duration_hours numeric(8,2),
  participant_count integer,
  total_volunteer_hours numeric(10,2),
  beneficiaries_reached integer,
  impact_description text,
  is_paid_time boolean NOT NULL DEFAULT false,
  volunteer_policy_hours numeric(8,2),
  evidence_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_volunteer_org
  ON public.community_volunteer_activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_community_volunteer_date
  ON public.community_volunteer_activities(activity_date);

ALTER TABLE public.community_volunteer_activities ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'community_volunteer_activities' AND policyname = 'org_member_select_volunteer'
  ) THEN
    CREATE POLICY org_member_select_volunteer ON public.community_volunteer_activities
      FOR SELECT USING (
        organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'community_volunteer_activities' AND policyname = 'org_member_insert_volunteer'
  ) THEN
    CREATE POLICY org_member_insert_volunteer ON public.community_volunteer_activities
      FOR INSERT WITH CHECK (
        organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'community_volunteer_activities' AND policyname = 'org_member_update_volunteer'
  ) THEN
    CREATE POLICY org_member_update_volunteer ON public.community_volunteer_activities
      FOR UPDATE USING (
        organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'community_volunteer_activities' AND policyname = 'org_member_delete_volunteer'
  ) THEN
    CREATE POLICY org_member_delete_volunteer ON public.community_volunteer_activities
      FOR DELETE USING (
        organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================================
-- 3. community_local_impact
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.community_local_impact (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reporting_year integer NOT NULL,
  reporting_quarter integer,
  total_employees integer,
  local_employees integer,
  local_definition text,
  total_procurement_spend numeric(14,2),
  local_procurement_spend numeric(14,2),
  local_supplier_count integer,
  total_supplier_count integer,
  corporate_tax_paid numeric(14,2),
  payroll_taxes_paid numeric(14,2),
  business_rates_paid numeric(14,2),
  community_investment_total numeric(14,2),
  infrastructure_investment numeric(14,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_local_impact_org
  ON public.community_local_impact(organization_id);
CREATE INDEX IF NOT EXISTS idx_community_local_impact_year
  ON public.community_local_impact(reporting_year);

ALTER TABLE public.community_local_impact ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'community_local_impact' AND policyname = 'org_member_select_local_impact'
  ) THEN
    CREATE POLICY org_member_select_local_impact ON public.community_local_impact
      FOR SELECT USING (
        organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'community_local_impact' AND policyname = 'org_member_insert_local_impact'
  ) THEN
    CREATE POLICY org_member_insert_local_impact ON public.community_local_impact
      FOR INSERT WITH CHECK (
        organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'community_local_impact' AND policyname = 'org_member_update_local_impact'
  ) THEN
    CREATE POLICY org_member_update_local_impact ON public.community_local_impact
      FOR UPDATE USING (
        organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'community_local_impact' AND policyname = 'org_member_delete_local_impact'
  ) THEN
    CREATE POLICY org_member_delete_local_impact ON public.community_local_impact
      FOR DELETE USING (
        organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================================
-- 4. community_engagements
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.community_engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  engagement_name text NOT NULL,
  engagement_type text,
  description text,
  start_date date,
  end_date date,
  stakeholder_group text,
  participants_count integer,
  outcome_summary text,
  evidence_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_engagements_org
  ON public.community_engagements(organization_id);

ALTER TABLE public.community_engagements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'community_engagements' AND policyname = 'org_member_select_engagements'
  ) THEN
    CREATE POLICY org_member_select_engagements ON public.community_engagements
      FOR SELECT USING (
        organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'community_engagements' AND policyname = 'org_member_insert_engagements'
  ) THEN
    CREATE POLICY org_member_insert_engagements ON public.community_engagements
      FOR INSERT WITH CHECK (
        organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'community_engagements' AND policyname = 'org_member_update_engagements'
  ) THEN
    CREATE POLICY org_member_update_engagements ON public.community_engagements
      FOR UPDATE USING (
        organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'community_engagements' AND policyname = 'org_member_delete_engagements'
  ) THEN
    CREATE POLICY org_member_delete_engagements ON public.community_engagements
      FOR DELETE USING (
        organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================================
-- 5. community_impact_stories
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.community_impact_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  story_type text,
  summary text,
  content text,
  beneficiary_quote text,
  impact_metrics jsonb DEFAULT '{}'::jsonb,
  media_urls text[],
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_impact_stories_org
  ON public.community_impact_stories(organization_id);

ALTER TABLE public.community_impact_stories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'community_impact_stories' AND policyname = 'org_member_select_stories'
  ) THEN
    CREATE POLICY org_member_select_stories ON public.community_impact_stories
      FOR SELECT USING (
        organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'community_impact_stories' AND policyname = 'org_member_insert_stories'
  ) THEN
    CREATE POLICY org_member_insert_stories ON public.community_impact_stories
      FOR INSERT WITH CHECK (
        organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'community_impact_stories' AND policyname = 'org_member_update_stories'
  ) THEN
    CREATE POLICY org_member_update_stories ON public.community_impact_stories
      FOR UPDATE USING (
        organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'community_impact_stories' AND policyname = 'org_member_delete_stories'
  ) THEN
    CREATE POLICY org_member_delete_stories ON public.community_impact_stories
      FOR DELETE USING (
        organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================================
-- 6. community_impact_scores
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.community_impact_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  overall_score numeric(5,1),
  giving_score numeric(5,1),
  local_impact_score numeric(5,1),
  volunteering_score numeric(5,1),
  engagement_score numeric(5,1),
  data_completeness numeric(5,1),
  calculation_period_start date,
  calculation_period_end date,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_impact_scores_org
  ON public.community_impact_scores(organization_id);
CREATE INDEX IF NOT EXISTS idx_community_impact_scores_calc
  ON public.community_impact_scores(calculated_at DESC);

ALTER TABLE public.community_impact_scores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'community_impact_scores' AND policyname = 'org_member_select_scores'
  ) THEN
    CREATE POLICY org_member_select_scores ON public.community_impact_scores
      FOR SELECT USING (
        organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'community_impact_scores' AND policyname = 'org_member_insert_scores'
  ) THEN
    CREATE POLICY org_member_insert_scores ON public.community_impact_scores
      FOR INSERT WITH CHECK (
        organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================================
-- 7. emission_factor_requests
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.emission_factor_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_query text,
  material_name text NOT NULL,
  material_type text,
  context text,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source_page text,
  product_id integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'researching', 'resolved', 'rejected', 'duplicate')),
  request_count integer NOT NULL DEFAULT 1,
  unique_org_count integer NOT NULL DEFAULT 1,
  priority_score integer NOT NULL DEFAULT 10,
  resolved_factor_id uuid,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emission_factor_requests_org
  ON public.emission_factor_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_emission_factor_requests_status
  ON public.emission_factor_requests(status);
CREATE INDEX IF NOT EXISTS idx_emission_factor_requests_priority
  ON public.emission_factor_requests(priority_score DESC);

ALTER TABLE public.emission_factor_requests ENABLE ROW LEVEL SECURITY;

-- Users can see their own org's requests
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'emission_factor_requests' AND policyname = 'org_member_select_factor_requests'
  ) THEN
    CREATE POLICY org_member_select_factor_requests ON public.emission_factor_requests
      FOR SELECT USING (
        organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Users can insert requests for their org
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'emission_factor_requests' AND policyname = 'org_member_insert_factor_requests'
  ) THEN
    CREATE POLICY org_member_insert_factor_requests ON public.emission_factor_requests
      FOR INSERT WITH CHECK (
        organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
      );
  END IF;
END $$;
