/*
  # Fix Data Quality Confidence Calculation Logic

  1. Problem
    - The previous view mixed COUNT(DISTINCT id) for total entries with SUM(CASE...) for category counts
    - This caused incorrect percentages when joining two tables (150%, -50%, etc.)
    - The DISTINCT count on joined tables doesn't match the sum of individual case statements

  2. Solution
    - Use UNION ALL to combine entries from both tables first
    - Then perform aggregation on the unified result set
    - This ensures consistent counting across all metrics

  3. Changes
    - Drop existing facility_confidence_summary view
    - Recreate with UNION-based approach
    - Maps data provenance correctly from both tables
    - Calculates accurate percentages and confidence scores
    - Note: utility_data_entries doesn't have organization_id, so we only track facility_id
*/

-- Drop the existing view
DROP VIEW IF EXISTS facility_confidence_summary;

-- Recreate with correct calculation logic using UNION approach
CREATE VIEW facility_confidence_summary AS
WITH combined_entries AS (
  -- Water, waste, and other facility activity entries
  SELECT 
    facility_id,
    id AS entry_id,
    CASE 
      WHEN data_provenance = 'primary_supplier_verified' THEN 'primary_verified'
      WHEN data_provenance = 'primary_measured_onsite' THEN 'primary_measured'
      WHEN data_provenance = 'secondary_calculated_allocation' THEN 'secondary_allocated'
      WHEN data_provenance = 'secondary_modelled_industry_average' THEN 'secondary_modelled'
      ELSE 'secondary_modelled'
    END AS provenance_category
  FROM facility_activity_entries
  WHERE facility_id IS NOT NULL

  UNION ALL

  -- Utility entries (electricity, gas, etc.)
  SELECT 
    facility_id,
    id AS entry_id,
    CASE 
      WHEN data_quality = 'actual' THEN 'primary_measured'
      WHEN data_quality = 'estimated' THEN 'secondary_modelled'
      ELSE 'secondary_modelled'
    END AS provenance_category
  FROM utility_data_entries
  WHERE facility_id IS NOT NULL
)
SELECT 
  facility_id,
  COUNT(*) AS total_entries,
  SUM(CASE WHEN provenance_category = 'primary_verified' THEN 1 ELSE 0 END) AS primary_verified_count,
  SUM(CASE WHEN provenance_category = 'primary_measured' THEN 1 ELSE 0 END) AS primary_measured_count,
  SUM(CASE WHEN provenance_category = 'secondary_allocated' THEN 1 ELSE 0 END) AS secondary_allocated_count,
  SUM(CASE WHEN provenance_category = 'secondary_modelled' THEN 1 ELSE 0 END) AS secondary_modelled_count,
  -- Calculate primary data percentage
  CASE 
    WHEN COUNT(*) > 0 THEN
      ROUND(((SUM(CASE WHEN provenance_category IN ('primary_verified', 'primary_measured') THEN 1 ELSE 0 END))::numeric / COUNT(*)::numeric) * 100, 2)
    ELSE 0
  END AS primary_data_percentage,
  -- Calculate overall confidence score (weighted)
  CASE 
    WHEN COUNT(*) > 0 THEN
      ROUND(
        ((SUM(CASE WHEN provenance_category = 'primary_verified' THEN 95.0 ELSE 0 END) + 
          SUM(CASE WHEN provenance_category = 'primary_measured' THEN 90.0 ELSE 0 END) + 
          SUM(CASE WHEN provenance_category = 'secondary_allocated' THEN 70.0 ELSE 0 END) + 
          SUM(CASE WHEN provenance_category = 'secondary_modelled' THEN 50.0 ELSE 0 END)) / COUNT(*)::numeric),
        2
      )
    ELSE 0
  END AS average_confidence_score,
  -- Assign confidence rating based on primary data percentage
  CASE 
    WHEN COUNT(*) = 0 THEN 'no_data'
    WHEN (SUM(CASE WHEN provenance_category IN ('primary_verified', 'primary_measured') THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric) >= 0.80 THEN 'high'
    WHEN (SUM(CASE WHEN provenance_category IN ('primary_verified', 'primary_measured') THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric) >= 0.50 THEN 'medium'
    WHEN (SUM(CASE WHEN provenance_category IN ('primary_verified', 'primary_measured') THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric) >= 0.30 THEN 'low'
    ELSE 'very_low'
  END AS confidence_rating
FROM combined_entries
GROUP BY facility_id;