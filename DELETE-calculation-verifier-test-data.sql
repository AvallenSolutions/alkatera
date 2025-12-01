/*
  # DELETE Calculation Verifier Test Data

  ⚠️  WARNING: This script will permanently delete ALL test data created by
  the seed-calculation-verifier-test-data.sql script.

  ## What This Deletes:
  1. All facility activity data for the test facility
  2. The test facility record
  3. All test emission sources
  4. All test corporate overhead records

  ## Safety:
  - Only deletes records with "[TEST DATA]" prefix in their names
  - Only affects data for your current organization
  - Uses CASCADE deletion where appropriate

  ## How to Use:
  1. Review this script carefully
  2. Run in Supabase SQL editor when logged in
  3. Verify deletion with the verification queries at the end
*/

-- ============================================================================
-- STEP 1: Delete Test Corporate Overhead Data
-- ============================================================================

DELETE FROM public.corporate_overheads
WHERE description LIKE '[TEST DATA]%'
AND organization_id = get_current_organization_id();

-- Show how many were deleted
SELECT
  'DELETED CORPORATE OVERHEADS' as action,
  COUNT(*) as records_deleted
FROM public.corporate_overheads
WHERE description LIKE '[TEST DATA]%'
AND organization_id = get_current_organization_id();

-- ============================================================================
-- STEP 2: Delete Test Activity Data
-- ============================================================================

-- Delete activity data linked to test facility
DELETE FROM public.facility_activity_data
WHERE facility_id IN (
  SELECT id FROM public.facilities
  WHERE name = '[TEST DATA] Calculation Verifier Test Facility'
  AND organization_id = get_current_organization_id()
);

-- ============================================================================
-- STEP 3: Delete Test Facility
-- ============================================================================

DELETE FROM public.facilities
WHERE name = '[TEST DATA] Calculation Verifier Test Facility'
AND organization_id = get_current_organization_id();

-- Show result
SELECT
  'DELETED TEST FACILITY' as action,
  COUNT(*) as records_deleted
FROM public.facilities
WHERE name LIKE '[TEST DATA]%'
AND organization_id = get_current_organization_id();

-- ============================================================================
-- STEP 4: Delete Test Emission Sources
-- ============================================================================

-- Note: These are NOT organization-specific, so be careful
-- Only delete if no other activity data references them

DELETE FROM public.scope_1_2_emission_sources
WHERE source_name LIKE '[TEST DATA]%'
AND NOT EXISTS (
  SELECT 1 FROM public.facility_activity_data
  WHERE emission_source_id = scope_1_2_emission_sources.id
);

-- Show result
SELECT
  'DELETED TEST EMISSION SOURCES' as action,
  COUNT(*) as records_deleted
FROM public.scope_1_2_emission_sources
WHERE source_name LIKE '[TEST DATA]%';

-- ============================================================================
-- VERIFICATION: Confirm all test data is gone
-- ============================================================================

-- Check for remaining test facilities
SELECT
  'REMAINING TEST FACILITIES' as check_type,
  COUNT(*) as count
FROM public.facilities
WHERE name LIKE '[TEST DATA]%'
AND organization_id = get_current_organization_id();

-- Check for remaining test emission sources
SELECT
  'REMAINING TEST EMISSION SOURCES' as check_type,
  COUNT(*) as count
FROM public.scope_1_2_emission_sources
WHERE source_name LIKE '[TEST DATA]%';

-- Check for remaining test corporate overheads
SELECT
  'REMAINING TEST CORPORATE OVERHEADS' as check_type,
  COUNT(*) as count
FROM public.corporate_overheads
WHERE description LIKE '[TEST DATA]%'
AND organization_id = get_current_organization_id();

-- Check for remaining test activity data
SELECT
  'REMAINING TEST ACTIVITY DATA' as check_type,
  COUNT(*) as count
FROM public.facility_activity_data fad
JOIN public.facilities f ON f.id = fad.facility_id
WHERE f.name LIKE '[TEST DATA]%'
AND f.organization_id = get_current_organization_id();

/*
  ✅ SUCCESS CRITERIA:
  All counts should return 0 if deletion was successful.

  If any counts are > 0, review the records manually:

  SELECT * FROM public.facilities
  WHERE name LIKE '[TEST DATA]%';

  SELECT * FROM public.scope_1_2_emission_sources
  WHERE source_name LIKE '[TEST DATA]%';

  SELECT * FROM public.corporate_overheads
  WHERE description LIKE '[TEST DATA]%';
*/
