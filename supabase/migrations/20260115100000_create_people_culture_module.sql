/*
  # Create People & Culture Module

  1. New Tables
    - `people_employee_compensation`
      - Stores anonymized compensation data for living wage and pay ratio analysis
      - Supports fair work compliance reporting
      - Enables gender pay gap calculations

    - `people_workforce_demographics`
      - Stores workforce demographic data for diversity tracking
      - Supports DEI reporting and benchmarking
      - Enables representation analysis

    - `people_dei_actions`
      - Tracks DEI initiatives and actions
      - Supports B Corp and CSRD reporting requirements
      - Enables progress monitoring

    - `people_training_records`
      - Logs training and development activities
      - Supports skills development tracking
      - Enables training hours reporting

    - `people_benefits`
      - Tracks employee benefits offerings
      - Supports benefits uptake analysis
      - Enables wellbeing program tracking

    - `people_employee_surveys`
      - Stores employee feedback surveys
      - Supports wellbeing measurement
      - Enables engagement tracking

    - `people_survey_responses`
      - Stores aggregated survey response data
      - Supports trend analysis
      - Enables benchmark comparisons

  2. Views
    - `people_culture_summary`
      - Aggregates key metrics for dashboard display
      - Calculates composite scores

  3. Security
    - Enable RLS on all new tables
    - Organizations can only access their own data
    - Service role can manage all data

  4. Compliance
    - Supports B Corp 2.1 People requirements
    - Supports CSRD ESRS S1 (Own Workforce)
    - Supports UK Gender Pay Gap Reporting
*/

-- ============================================
-- Table: people_employee_compensation
-- Purpose: Fair work and living wage analysis
-- ============================================
CREATE TABLE IF NOT EXISTS people_employee_compensation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Employee identification (anonymized)
  employee_reference varchar(255), -- Internal reference, not PII

  -- Role and classification
  role_title varchar(255),
  role_level varchar(100), -- entry, junior, mid, senior, lead, manager, director, executive
  department varchar(255),
  employment_type varchar(50) NOT NULL DEFAULT 'full_time', -- full_time, part_time, contractor, intern
  contract_type varchar(50), -- permanent, fixed_term, zero_hours

  -- Location for living wage benchmarking
  work_location varchar(255),
  work_country varchar(100) DEFAULT 'United Kingdom',
  work_region varchar(100), -- For regional living wage comparisons
  is_remote boolean DEFAULT false,

  -- Compensation data
  annual_salary decimal(12,2),
  hourly_rate decimal(8,2),
  currency varchar(3) DEFAULT 'GBP',
  hours_per_week decimal(4,1) DEFAULT 40,

  -- Additional compensation
  bonus_amount decimal(12,2) DEFAULT 0,
  bonus_received boolean DEFAULT false,

  -- Demographics for pay gap analysis (voluntary, aggregated)
  gender varchar(50), -- male, female, non_binary, prefer_not_to_say

  -- Reporting period
  reporting_year int NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  effective_date date DEFAULT CURRENT_DATE,

  -- Metadata
  data_source varchar(100), -- manual, hris_import, payroll_import
  is_active boolean DEFAULT true,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for compensation table
CREATE INDEX IF NOT EXISTS idx_compensation_org_year
  ON people_employee_compensation(organization_id, reporting_year DESC);
CREATE INDEX IF NOT EXISTS idx_compensation_department
  ON people_employee_compensation(organization_id, department);
CREATE INDEX IF NOT EXISTS idx_compensation_gender
  ON people_employee_compensation(organization_id, gender) WHERE gender IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compensation_location
  ON people_employee_compensation(organization_id, work_country, work_region);

-- Enable RLS
ALTER TABLE people_employee_compensation ENABLE ROW LEVEL SECURITY;

-- RLS Policies for compensation
CREATE POLICY "Organizations can view own compensation data"
  ON people_employee_compensation
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organizations can insert own compensation data"
  ON people_employee_compensation
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organizations can update own compensation data"
  ON people_employee_compensation
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organizations can delete own compensation data"
  ON people_employee_compensation
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all compensation data"
  ON people_employee_compensation
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Table: people_workforce_demographics
-- Purpose: Diversity and representation tracking
-- ============================================
CREATE TABLE IF NOT EXISTS people_workforce_demographics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Reporting period
  reporting_period date NOT NULL,
  reporting_year int NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),

  -- Total headcount
  total_employees int NOT NULL DEFAULT 0,
  total_fte decimal(10,2), -- Full-time equivalent

  -- Gender breakdown (JSONB for flexibility)
  gender_data jsonb DEFAULT '{
    "male": 0,
    "female": 0,
    "non_binary": 0,
    "prefer_not_to_say": 0,
    "not_disclosed": 0
  }'::jsonb,

  -- Ethnicity breakdown (JSONB for regional variations)
  ethnicity_data jsonb DEFAULT '{}'::jsonb,

  -- Age breakdown
  age_data jsonb DEFAULT '{
    "under_25": 0,
    "25_34": 0,
    "35_44": 0,
    "45_54": 0,
    "55_64": 0,
    "65_plus": 0,
    "not_disclosed": 0
  }'::jsonb,

  -- Disability data
  disability_data jsonb DEFAULT '{
    "disclosed_disability": 0,
    "no_disability": 0,
    "prefer_not_to_say": 0,
    "not_disclosed": 0
  }'::jsonb,

  -- Management/leadership breakdown
  management_breakdown jsonb DEFAULT '{
    "board": {"total": 0, "gender": {}, "ethnicity": {}},
    "executive": {"total": 0, "gender": {}, "ethnicity": {}},
    "senior_management": {"total": 0, "gender": {}, "ethnicity": {}},
    "management": {"total": 0, "gender": {}, "ethnicity": {}},
    "non_management": {"total": 0, "gender": {}, "ethnicity": {}}
  }'::jsonb,

  -- Employment type breakdown
  employment_type_breakdown jsonb DEFAULT '{
    "full_time": 0,
    "part_time": 0,
    "contractor": 0,
    "intern": 0
  }'::jsonb,

  -- Turnover metrics
  new_hires int DEFAULT 0,
  departures int DEFAULT 0,
  voluntary_departures int DEFAULT 0,

  -- Data quality
  response_rate decimal(5,2), -- % of employees who provided demographic data
  data_collection_method varchar(100), -- survey, hris, voluntary_disclosure

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(organization_id, reporting_period)
);

-- Indexes for demographics table
CREATE INDEX IF NOT EXISTS idx_demographics_org_period
  ON people_workforce_demographics(organization_id, reporting_period DESC);
CREATE INDEX IF NOT EXISTS idx_demographics_year
  ON people_workforce_demographics(organization_id, reporting_year DESC);

-- Enable RLS
ALTER TABLE people_workforce_demographics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for demographics
CREATE POLICY "Organizations can view own demographics"
  ON people_workforce_demographics
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organizations can insert own demographics"
  ON people_workforce_demographics
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organizations can update own demographics"
  ON people_workforce_demographics
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organizations can delete own demographics"
  ON people_workforce_demographics
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all demographics"
  ON people_workforce_demographics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Table: people_dei_actions
-- Purpose: DEI initiative tracking
-- ============================================
CREATE TABLE IF NOT EXISTS people_dei_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Action details
  action_name varchar(255) NOT NULL,
  action_category varchar(100) NOT NULL, -- recruitment, retention, development, culture, accessibility, policy
  description text,

  -- Target group
  target_group varchar(100), -- gender, ethnicity, disability, age, lgbtq, all

  -- Status tracking
  status varchar(50) NOT NULL DEFAULT 'planned', -- planned, in_progress, completed, on_hold, cancelled
  priority varchar(20) DEFAULT 'medium', -- low, medium, high, critical

  -- Timeline
  start_date date,
  target_date date,
  completion_date date,

  -- Ownership
  owner_name varchar(255),
  owner_department varchar(255),

  -- Outcomes and measurement
  success_metrics text,
  outcomes_achieved text,

  -- Evidence and documentation
  evidence_links jsonb DEFAULT '[]'::jsonb, -- Array of {url, description, type}

  -- B Corp alignment
  bcorp_requirement_id varchar(50), -- Maps to B Corp JEDI requirements

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for DEI actions
CREATE INDEX IF NOT EXISTS idx_dei_actions_org
  ON people_dei_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_dei_actions_status
  ON people_dei_actions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_dei_actions_category
  ON people_dei_actions(organization_id, action_category);

-- Enable RLS
ALTER TABLE people_dei_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for DEI actions
CREATE POLICY "Organizations can view own DEI actions"
  ON people_dei_actions
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organizations can insert own DEI actions"
  ON people_dei_actions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organizations can update own DEI actions"
  ON people_dei_actions
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organizations can delete own DEI actions"
  ON people_dei_actions
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all DEI actions"
  ON people_dei_actions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Table: people_training_records
-- Purpose: Training and development tracking
-- ============================================
CREATE TABLE IF NOT EXISTS people_training_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Training details
  training_name varchar(255) NOT NULL,
  training_type varchar(100) NOT NULL, -- mandatory, professional_development, leadership, dei, health_safety, sustainability, technical
  description text,

  -- Provider
  provider_type varchar(50), -- internal, external, online
  provider_name varchar(255),

  -- Delivery
  delivery_method varchar(50), -- in_person, virtual, self_paced, blended

  -- Duration and participation
  hours_per_participant decimal(6,2) NOT NULL DEFAULT 0,
  total_hours decimal(10,2), -- Calculated: hours_per_participant * participants
  participants int NOT NULL DEFAULT 0,
  eligible_employees int, -- For completion rate calculation

  -- Timing
  start_date date,
  completion_date date,
  reporting_year int NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),

  -- Certification
  certification_awarded boolean DEFAULT false,
  certification_name varchar(255),

  -- Cost tracking (optional)
  cost_per_participant decimal(10,2),
  total_cost decimal(12,2),
  currency varchar(3) DEFAULT 'GBP',

  -- Outcomes
  completion_rate decimal(5,2), -- % of eligible who completed
  satisfaction_score decimal(3,1), -- 1-5 scale

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for training records
CREATE INDEX IF NOT EXISTS idx_training_org_year
  ON people_training_records(organization_id, reporting_year DESC);
CREATE INDEX IF NOT EXISTS idx_training_type
  ON people_training_records(organization_id, training_type);

-- Enable RLS
ALTER TABLE people_training_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for training records
CREATE POLICY "Organizations can view own training records"
  ON people_training_records
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organizations can insert own training records"
  ON people_training_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organizations can update own training records"
  ON people_training_records
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organizations can delete own training records"
  ON people_training_records
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all training records"
  ON people_training_records
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Table: people_benefits
-- Purpose: Employee benefits tracking
-- ============================================
CREATE TABLE IF NOT EXISTS people_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Benefit details
  benefit_name varchar(255) NOT NULL,
  benefit_type varchar(100) NOT NULL, -- health, pension, leave, flexible_working, wellness, financial, family, development
  description text,

  -- Eligibility
  eligibility_criteria text,
  eligible_employee_count int,

  -- Uptake
  uptake_count int DEFAULT 0,
  uptake_rate decimal(5,2), -- Calculated: (uptake_count / eligible_employee_count) * 100

  -- Cost (optional)
  employer_contribution decimal(12,2),
  employee_contribution decimal(12,2),
  currency varchar(3) DEFAULT 'GBP',

  -- Status
  is_active boolean DEFAULT true,
  effective_from date,
  effective_to date,

  -- Reporting
  reporting_year int NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for benefits
CREATE INDEX IF NOT EXISTS idx_benefits_org
  ON people_benefits(organization_id);
CREATE INDEX IF NOT EXISTS idx_benefits_type
  ON people_benefits(organization_id, benefit_type);
CREATE INDEX IF NOT EXISTS idx_benefits_active
  ON people_benefits(organization_id, is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE people_benefits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for benefits
CREATE POLICY "Organizations can view own benefits"
  ON people_benefits
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organizations can insert own benefits"
  ON people_benefits
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organizations can update own benefits"
  ON people_benefits
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organizations can delete own benefits"
  ON people_benefits
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all benefits"
  ON people_benefits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Table: people_employee_surveys
-- Purpose: Employee feedback and engagement surveys
-- ============================================
CREATE TABLE IF NOT EXISTS people_employee_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Survey details
  survey_name varchar(255) NOT NULL,
  survey_type varchar(100) NOT NULL, -- engagement, wellbeing, pulse, exit, onboarding, dei, custom
  description text,

  -- Status
  status varchar(50) NOT NULL DEFAULT 'draft', -- draft, active, closed, archived

  -- Timeline
  launch_date date,
  close_date date,

  -- Participation
  total_invited int DEFAULT 0,
  total_responses int DEFAULT 0,
  response_rate decimal(5,2), -- Calculated: (total_responses / total_invited) * 100

  -- Configuration
  is_anonymous boolean DEFAULT true,
  survey_questions jsonb DEFAULT '[]'::jsonb, -- Array of question objects

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for surveys
CREATE INDEX IF NOT EXISTS idx_surveys_org
  ON people_employee_surveys(organization_id);
CREATE INDEX IF NOT EXISTS idx_surveys_status
  ON people_employee_surveys(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_surveys_type
  ON people_employee_surveys(organization_id, survey_type);

-- Enable RLS
ALTER TABLE people_employee_surveys ENABLE ROW LEVEL SECURITY;

-- RLS Policies for surveys
CREATE POLICY "Organizations can view own surveys"
  ON people_employee_surveys
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organizations can insert own surveys"
  ON people_employee_surveys
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organizations can update own surveys"
  ON people_employee_surveys
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organizations can delete own surveys"
  ON people_employee_surveys
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all surveys"
  ON people_employee_surveys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Table: people_survey_responses
-- Purpose: Aggregated survey response data
-- ============================================
CREATE TABLE IF NOT EXISTS people_survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES people_employee_surveys(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Response timestamp
  response_date timestamptz DEFAULT now(),

  -- Aggregated scores (stored as aggregates, not individual responses)
  overall_score decimal(3,1), -- 1-5 scale aggregate

  -- Category scores (JSONB for flexibility)
  category_scores jsonb DEFAULT '{}'::jsonb, -- e.g., {"engagement": 4.2, "wellbeing": 3.8, "leadership": 4.0}

  -- Question-level aggregates
  question_aggregates jsonb DEFAULT '[]'::jsonb, -- Array of {question_id, avg_score, response_count}

  -- Free text themes (aggregated, not individual)
  positive_themes jsonb DEFAULT '[]'::jsonb,
  improvement_themes jsonb DEFAULT '[]'::jsonb,

  -- Demographic breakdown (optional, aggregated)
  demographic_breakdown jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now()
);

-- Indexes for survey responses
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey
  ON people_survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_org
  ON people_survey_responses(organization_id);

-- Enable RLS
ALTER TABLE people_survey_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for survey responses
CREATE POLICY "Organizations can view own survey responses"
  ON people_survey_responses
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organizations can insert own survey responses"
  ON people_survey_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all survey responses"
  ON people_survey_responses
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Table: people_culture_scores
-- Purpose: Store calculated People & Culture scores
-- ============================================
CREATE TABLE IF NOT EXISTS people_culture_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Calculation metadata
  calculation_date timestamptz NOT NULL DEFAULT now(),
  reporting_year int NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),

  -- Overall score
  overall_score int NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),

  -- Pillar scores
  fair_work_score int CHECK (fair_work_score >= 0 AND fair_work_score <= 100),
  diversity_score int CHECK (diversity_score >= 0 AND diversity_score <= 100),
  wellbeing_score int CHECK (wellbeing_score >= 0 AND wellbeing_score <= 100),
  training_score int CHECK (training_score >= 0 AND training_score <= 100),

  -- Supporting metrics
  living_wage_compliance decimal(5,2), -- % of employees at/above living wage
  gender_pay_gap_mean decimal(5,2), -- Mean gender pay gap %
  gender_pay_gap_median decimal(5,2), -- Median gender pay gap %
  ceo_worker_pay_ratio decimal(10,2), -- CEO to median worker ratio
  training_hours_per_employee decimal(6,2),
  employee_engagement_score decimal(3,1), -- From surveys

  -- Data quality indicators
  data_completeness decimal(5,2), -- % of required data provided
  calculation_metadata jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(organization_id, reporting_year, calculation_date)
);

-- Indexes for scores
CREATE INDEX IF NOT EXISTS idx_people_scores_org_year
  ON people_culture_scores(organization_id, reporting_year DESC);
CREATE INDEX IF NOT EXISTS idx_people_scores_overall
  ON people_culture_scores(overall_score DESC);

-- Enable RLS
ALTER TABLE people_culture_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scores
CREATE POLICY "Organizations can view own people culture scores"
  ON people_culture_scores
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage people culture scores"
  ON people_culture_scores
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Table: people_living_wage_benchmarks
-- Purpose: Regional living wage reference data
-- ============================================
CREATE TABLE IF NOT EXISTS people_living_wage_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Location
  country varchar(100) NOT NULL,
  region varchar(100), -- NULL for national rates
  city varchar(100), -- For city-specific rates like London

  -- Wage rates
  hourly_rate decimal(8,2) NOT NULL,
  annual_rate decimal(12,2), -- Based on standard hours
  currency varchar(3) DEFAULT 'GBP',

  -- Source and methodology
  source varchar(255) NOT NULL, -- e.g., "Living Wage Foundation", "Anker Methodology"
  methodology varchar(100), -- living_wage_foundation, anker, statutory_minimum

  -- Validity
  effective_from date NOT NULL,
  effective_to date,
  is_current boolean DEFAULT true,

  -- Metadata
  notes text,
  source_url text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(country, region, city, source, effective_from)
);

-- Indexes for benchmarks
CREATE INDEX IF NOT EXISTS idx_living_wage_country
  ON people_living_wage_benchmarks(country);
CREATE INDEX IF NOT EXISTS idx_living_wage_current
  ON people_living_wage_benchmarks(is_current) WHERE is_current = true;

-- Seed UK Living Wage Foundation rates
INSERT INTO people_living_wage_benchmarks (country, region, city, hourly_rate, annual_rate, currency, source, methodology, effective_from, is_current)
VALUES
  ('United Kingdom', NULL, NULL, 12.00, 24960.00, 'GBP', 'Living Wage Foundation', 'living_wage_foundation', '2024-04-01', true),
  ('United Kingdom', 'London', 'London', 13.15, 27352.00, 'GBP', 'Living Wage Foundation', 'living_wage_foundation', '2024-04-01', true),
  ('United Kingdom', NULL, NULL, 11.44, 23795.20, 'GBP', 'UK Government', 'statutory_minimum', '2024-04-01', true)
ON CONFLICT DO NOTHING;

-- ============================================
-- View: people_culture_summary
-- Purpose: Dashboard summary view
-- ============================================
CREATE OR REPLACE VIEW people_culture_summary AS
WITH latest_demographics AS (
  SELECT DISTINCT ON (organization_id)
    organization_id,
    total_employees,
    gender_data,
    reporting_period,
    response_rate as demographic_response_rate
  FROM people_workforce_demographics
  ORDER BY organization_id, reporting_period DESC
),
compensation_stats AS (
  SELECT
    organization_id,
    COUNT(*) as compensation_records,
    AVG(annual_salary) as avg_salary,
    MAX(annual_salary) as max_salary,
    MIN(annual_salary) FILTER (WHERE annual_salary > 0) as min_salary,
    COUNT(*) FILTER (WHERE gender = 'male') as male_count,
    COUNT(*) FILTER (WHERE gender = 'female') as female_count,
    AVG(annual_salary) FILTER (WHERE gender = 'male') as male_avg_salary,
    AVG(annual_salary) FILTER (WHERE gender = 'female') as female_avg_salary
  FROM people_employee_compensation
  WHERE is_active = true
  GROUP BY organization_id
),
training_stats AS (
  SELECT
    organization_id,
    SUM(total_hours) as total_training_hours,
    SUM(participants) as total_participants,
    COUNT(*) as training_count
  FROM people_training_records
  WHERE reporting_year = EXTRACT(YEAR FROM CURRENT_DATE)
  GROUP BY organization_id
),
dei_stats AS (
  SELECT
    organization_id,
    COUNT(*) as total_actions,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_actions,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_actions
  FROM people_dei_actions
  GROUP BY organization_id
),
latest_scores AS (
  SELECT DISTINCT ON (organization_id)
    organization_id,
    overall_score,
    fair_work_score,
    diversity_score,
    wellbeing_score,
    training_score,
    living_wage_compliance,
    gender_pay_gap_mean,
    calculation_date
  FROM people_culture_scores
  ORDER BY organization_id, calculation_date DESC
)
SELECT
  o.id as organization_id,
  o.name as organization_name,

  -- Demographics
  COALESCE(ld.total_employees, 0) as total_employees,
  ld.gender_data,
  ld.reporting_period as latest_demographics_date,

  -- Compensation
  cs.compensation_records,
  cs.avg_salary,
  CASE
    WHEN cs.male_avg_salary > 0 AND cs.female_avg_salary > 0
    THEN ROUND(((cs.male_avg_salary - cs.female_avg_salary) / cs.male_avg_salary * 100)::numeric, 2)
    ELSE NULL
  END as calculated_pay_gap,

  -- Training
  COALESCE(ts.total_training_hours, 0) as total_training_hours,
  CASE
    WHEN ld.total_employees > 0
    THEN ROUND((ts.total_training_hours / ld.total_employees)::numeric, 2)
    ELSE 0
  END as training_hours_per_employee,

  -- DEI
  COALESCE(ds.total_actions, 0) as dei_total_actions,
  COALESCE(ds.completed_actions, 0) as dei_completed_actions,

  -- Latest scores
  ls.overall_score as people_culture_score,
  ls.fair_work_score,
  ls.diversity_score,
  ls.wellbeing_score,
  ls.training_score,
  ls.living_wage_compliance,
  ls.gender_pay_gap_mean,
  ls.calculation_date as score_calculation_date

FROM organizations o
LEFT JOIN latest_demographics ld ON ld.organization_id = o.id
LEFT JOIN compensation_stats cs ON cs.organization_id = o.id
LEFT JOIN training_stats ts ON ts.organization_id = o.id
LEFT JOIN dei_stats ds ON ds.organization_id = o.id
LEFT JOIN latest_scores ls ON ls.organization_id = o.id;

-- ============================================
-- Triggers for updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_people_culture_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_compensation_updated_at
  BEFORE UPDATE ON people_employee_compensation
  FOR EACH ROW EXECUTE FUNCTION update_people_culture_updated_at();

CREATE TRIGGER update_demographics_updated_at
  BEFORE UPDATE ON people_workforce_demographics
  FOR EACH ROW EXECUTE FUNCTION update_people_culture_updated_at();

CREATE TRIGGER update_dei_actions_updated_at
  BEFORE UPDATE ON people_dei_actions
  FOR EACH ROW EXECUTE FUNCTION update_people_culture_updated_at();

CREATE TRIGGER update_training_updated_at
  BEFORE UPDATE ON people_training_records
  FOR EACH ROW EXECUTE FUNCTION update_people_culture_updated_at();

CREATE TRIGGER update_benefits_updated_at
  BEFORE UPDATE ON people_benefits
  FOR EACH ROW EXECUTE FUNCTION update_people_culture_updated_at();

CREATE TRIGGER update_surveys_updated_at
  BEFORE UPDATE ON people_employee_surveys
  FOR EACH ROW EXECUTE FUNCTION update_people_culture_updated_at();

CREATE TRIGGER update_people_scores_updated_at
  BEFORE UPDATE ON people_culture_scores
  FOR EACH ROW EXECUTE FUNCTION update_people_culture_updated_at();

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON TABLE people_employee_compensation IS 'Stores anonymized employee compensation data for fair work analysis, living wage compliance, and gender pay gap calculations. Part of People & Culture module.';
COMMENT ON TABLE people_workforce_demographics IS 'Stores workforce demographic data for diversity and inclusion tracking. Supports CSRD ESRS S1 and B Corp JEDI requirements.';
COMMENT ON TABLE people_dei_actions IS 'Tracks diversity, equity, and inclusion initiatives. Maps to B Corp JEDI requirements.';
COMMENT ON TABLE people_training_records IS 'Logs training and development activities for skills tracking and reporting.';
COMMENT ON TABLE people_benefits IS 'Tracks employee benefits offerings and uptake for wellbeing analysis.';
COMMENT ON TABLE people_employee_surveys IS 'Stores employee feedback survey configurations.';
COMMENT ON TABLE people_survey_responses IS 'Stores aggregated survey response data. Individual responses are not stored to maintain anonymity.';
COMMENT ON TABLE people_culture_scores IS 'Stores calculated People & Culture pillar scores. Separate from Company Vitality Score.';
COMMENT ON TABLE people_living_wage_benchmarks IS 'Reference data for regional living wage benchmarks from various sources.';
COMMENT ON VIEW people_culture_summary IS 'Aggregated view of People & Culture metrics for dashboard display.';
