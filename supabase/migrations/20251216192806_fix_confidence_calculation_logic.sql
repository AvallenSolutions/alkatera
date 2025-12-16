/*
  # Fix confidence calculation logic

  The previous view was incorrectly mixing:
  - COUNT(DISTINCT id) for total entries
  - SUM(CASE...) for categorizing (which counts all rows including duplicates from joins)

  This created percentages > 100% and negative values.

  Solution: Use consistent DISTINCT counting or restructure to avoid the mismatch.
  We'll use a UNION approach to combine both data sources before aggregation.
*/

DROP VIEW IF EXISTS facility_confidence_summary CASCADE;

CREATE VIEW facility_confidence_summary AS
WITH combined_entries AS (
  -- Facility activity entries (water, waste, utilities)
  SELECT
    fae.facility_id,
    f.organization_id,
    fae.id AS entry_id,
    CASE
      WHEN fae.data_provenance = 'primary_supplier_verified' THEN 'primary_verified'
      WHEN fae.data_provenance = 'primary_measured_onsite' THEN 'primary_measured'
      WHEN fae.data_provenance = 'secondary_modelled_industry_average' THEN 'secondary_modelled'
      WHEN fae.data_provenance = 'secondary_calculated_allocation' THEN 'secondary_allocated'
      ELSE 'unknown'
    END AS provenance_category
  FROM facility_activity_entries fae
  JOIN facilities f ON f.id = fae.facility_id

  UNION ALL

  -- Utility data entries
  SELECT
    ude.facility_id,
    f.organization_id,
    ude.id AS entry_id,
    CASE
      WHEN ude.data_quality = 'actual' THEN 'primary_measured'
      WHEN ude.data_quality = 'estimated' THEN 'secondary_modelled'
      ELSE 'unknown'
    END AS provenance_category
  FROM utility_data_entries ude
  JOIN facilities f ON f.id = ude.facility_id
)
SELECT
  facility_id,
  organization_id,
  COUNT(*) AS total_entries,
  SUM(CASE WHEN provenance_category = 'primary_verified' THEN 1 ELSE 0 END) AS primary_verified_count,
  SUM(CASE WHEN provenance_category = 'primary_measured' THEN 1 ELSE 0 END) AS primary_measured_count,
  SUM(CASE WHEN provenance_category = 'secondary_modelled' THEN 1 ELSE 0 END) AS secondary_modelled_count,
  SUM(CASE WHEN provenance_category = 'secondary_allocated' THEN 1 ELSE 0 END) AS secondary_allocated_count,
  CASE
    WHEN COUNT(*) = 0 THEN 0
    ELSE ROUND(
      (
        SUM(CASE WHEN provenance_category IN ('primary_verified', 'primary_measured') THEN 1 ELSE 0 END)::numeric 
        / COUNT(*)::numeric * 100
      ),
      1
    )
  END AS primary_data_percentage,
  CASE
    WHEN COUNT(*) = 0 THEN 0
    ELSE ROUND(
      (
        SUM(CASE WHEN provenance_category IN ('primary_verified', 'primary_measured') THEN 1 ELSE 0 END)::numeric 
        / COUNT(*)::numeric * 100
      ),
      1
    )
  END AS average_confidence_score,
  CASE
    WHEN COUNT(*) = 0 THEN 'very_low'
    WHEN (
      SUM(CASE WHEN provenance_category IN ('primary_verified', 'primary_measured') THEN 1 ELSE 0 END)::numeric 
      / COUNT(*)::numeric * 100
    ) >= 80 THEN 'high'
    WHEN (
      SUM(CASE WHEN provenance_category IN ('primary_verified', 'primary_measured') THEN 1 ELSE 0 END)::numeric 
      / COUNT(*)::numeric * 100
    ) >= 50 THEN 'medium'
    WHEN (
      SUM(CASE WHEN provenance_category IN ('primary_verified', 'primary_measured') THEN 1 ELSE 0 END)::numeric 
      / COUNT(*)::numeric * 100
    ) >= 20 THEN 'low'
    ELSE 'very_low'
  END AS confidence_rating
FROM combined_entries
GROUP BY facility_id, organization_id;
