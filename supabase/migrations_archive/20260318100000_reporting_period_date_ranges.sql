-- Migration: Add reporting_period_start and reporting_period_end to social & governance tables
-- This converts single-date/year-based reporting periods to date ranges
-- Old columns (reporting_period, reporting_year) are retained for backward compatibility

-- ============================================================================
-- 1. people_workforce_demographics
-- ============================================================================
ALTER TABLE people_workforce_demographics
  ADD COLUMN IF NOT EXISTS reporting_period_start date,
  ADD COLUMN IF NOT EXISTS reporting_period_end date;

-- Backfill from existing reporting_period (treat as month range)
UPDATE people_workforce_demographics
SET
  reporting_period_start = date_trunc('month', reporting_period)::date,
  reporting_period_end = (date_trunc('month', reporting_period) + interval '1 month' - interval '1 day')::date
WHERE reporting_period IS NOT NULL
  AND reporting_period_start IS NULL;

-- Backfill from reporting_year (full year range)
UPDATE people_workforce_demographics
SET
  reporting_period_start = make_date(reporting_year, 1, 1),
  reporting_period_end = make_date(reporting_year, 12, 31)
WHERE reporting_period IS NULL
  AND reporting_period_start IS NULL
  AND reporting_year IS NOT NULL;

ALTER TABLE people_workforce_demographics
  ADD CONSTRAINT chk_demographics_period_range
  CHECK (reporting_period_start IS NULL OR reporting_period_end IS NULL OR reporting_period_start <= reporting_period_end);

-- ============================================================================
-- 2. people_employee_compensation
-- ============================================================================
ALTER TABLE people_employee_compensation
  ADD COLUMN IF NOT EXISTS reporting_period_start date,
  ADD COLUMN IF NOT EXISTS reporting_period_end date;

UPDATE people_employee_compensation
SET
  reporting_period_start = make_date(reporting_year, 1, 1),
  reporting_period_end = make_date(reporting_year, 12, 31)
WHERE reporting_period_start IS NULL
  AND reporting_year IS NOT NULL;

ALTER TABLE people_employee_compensation
  ADD CONSTRAINT chk_compensation_period_range
  CHECK (reporting_period_start IS NULL OR reporting_period_end IS NULL OR reporting_period_start <= reporting_period_end);

-- ============================================================================
-- 3. people_training_records
-- ============================================================================
ALTER TABLE people_training_records
  ADD COLUMN IF NOT EXISTS reporting_period_start date,
  ADD COLUMN IF NOT EXISTS reporting_period_end date;

UPDATE people_training_records
SET
  reporting_period_start = make_date(reporting_year, 1, 1),
  reporting_period_end = make_date(reporting_year, 12, 31)
WHERE reporting_period_start IS NULL
  AND reporting_year IS NOT NULL;

ALTER TABLE people_training_records
  ADD CONSTRAINT chk_training_period_range
  CHECK (reporting_period_start IS NULL OR reporting_period_end IS NULL OR reporting_period_start <= reporting_period_end);

-- ============================================================================
-- 4. people_benefits
-- ============================================================================
ALTER TABLE people_benefits
  ADD COLUMN IF NOT EXISTS reporting_period_start date,
  ADD COLUMN IF NOT EXISTS reporting_period_end date;

UPDATE people_benefits
SET
  reporting_period_start = make_date(reporting_year, 1, 1),
  reporting_period_end = make_date(reporting_year, 12, 31)
WHERE reporting_period_start IS NULL
  AND reporting_year IS NOT NULL;

ALTER TABLE people_benefits
  ADD CONSTRAINT chk_benefits_period_range
  CHECK (reporting_period_start IS NULL OR reporting_period_end IS NULL OR reporting_period_start <= reporting_period_end);

-- ============================================================================
-- 5. governance_board_members
-- ============================================================================
ALTER TABLE governance_board_members
  ADD COLUMN IF NOT EXISTS reporting_period_start date,
  ADD COLUMN IF NOT EXISTS reporting_period_end date;

ALTER TABLE governance_board_members
  ADD CONSTRAINT chk_board_period_range
  CHECK (reporting_period_start IS NULL OR reporting_period_end IS NULL OR reporting_period_start <= reporting_period_end);

-- ============================================================================
-- 6. governance_ethics_records
-- ============================================================================
ALTER TABLE governance_ethics_records
  ADD COLUMN IF NOT EXISTS reporting_period_start date,
  ADD COLUMN IF NOT EXISTS reporting_period_end date;

ALTER TABLE governance_ethics_records
  ADD CONSTRAINT chk_ethics_period_range
  CHECK (reporting_period_start IS NULL OR reporting_period_end IS NULL OR reporting_period_start <= reporting_period_end);
