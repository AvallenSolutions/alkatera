/*
  # Fix facility confidence summary to include utilities

  Updates the facility_confidence_summary view to aggregate data from BOTH:
  - facility_activity_entries (new unified system for water/waste/utilities)
  - utility_data_entries (legacy utilities system still in use)

  This ensures that when users enter utility data through the utilities form,
  it counts towards the data quality confidence score.
*/

DROP VIEW IF EXISTS facility_confidence_summary CASCADE;

CREATE VIEW facility_confidence_summary AS
SELECT
  f.id AS facility_id,
  f.organization_id,
  -- Total entries from both tables
  COALESCE(COUNT(DISTINCT fae.id), 0) + COALESCE(COUNT(DISTINCT ude.id), 0) AS total_entries,
  
  -- Primary verified count (from facility_activity_entries only, utilities don't have this granularity)
  COALESCE(
    SUM(CASE WHEN fae.data_provenance = 'primary_supplier_verified' THEN 1 ELSE 0 END),
    0
  ) AS primary_verified_count,
  
  -- Primary measured count
  -- - facility_activity_entries with primary_measured_onsite
  -- - utility_data_entries with data_quality = 'actual'
  COALESCE(
    SUM(CASE WHEN fae.data_provenance = 'primary_measured_onsite' THEN 1 ELSE 0 END),
    0
  ) + COALESCE(
    SUM(CASE WHEN ude.data_quality = 'actual' THEN 1 ELSE 0 END),
    0
  ) AS primary_measured_count,
  
  -- Secondary modelled count
  -- - facility_activity_entries with secondary_modelled_industry_average
  -- - utility_data_entries with data_quality = 'estimated'
  COALESCE(
    SUM(CASE WHEN fae.data_provenance = 'secondary_modelled_industry_average' THEN 1 ELSE 0 END),
    0
  ) + COALESCE(
    SUM(CASE WHEN ude.data_quality = 'estimated' THEN 1 ELSE 0 END),
    0
  ) AS secondary_modelled_count,
  
  -- Secondary allocated count (from facility_activity_entries only)
  COALESCE(
    SUM(CASE WHEN fae.data_provenance = 'secondary_calculated_allocation' THEN 1 ELSE 0 END),
    0
  ) AS secondary_allocated_count,
  
  -- Calculate primary data percentage
  CASE
    WHEN (COALESCE(COUNT(DISTINCT fae.id), 0) + COALESCE(COUNT(DISTINCT ude.id), 0)) = 0 THEN 0
    ELSE (
      (
        -- Primary verified from FAE
        COALESCE(
          SUM(CASE WHEN fae.data_provenance = 'primary_supplier_verified' THEN 1 ELSE 0 END),
          0
        ) +
        -- Primary measured from FAE
        COALESCE(
          SUM(CASE WHEN fae.data_provenance = 'primary_measured_onsite' THEN 1 ELSE 0 END),
          0
        ) +
        -- Primary measured from utilities (actual readings)
        COALESCE(
          SUM(CASE WHEN ude.data_quality = 'actual' THEN 1 ELSE 0 END),
          0
        )
      )::numeric / (COALESCE(COUNT(DISTINCT fae.id), 0) + COALESCE(COUNT(DISTINCT ude.id), 0)) * 100
    )
  END AS primary_data_percentage,
  
  -- Average confidence score (same as primary_data_percentage)
  CASE
    WHEN (COALESCE(COUNT(DISTINCT fae.id), 0) + COALESCE(COUNT(DISTINCT ude.id), 0)) = 0 THEN 0
    ELSE (
      (
        COALESCE(
          SUM(CASE WHEN fae.data_provenance = 'primary_supplier_verified' THEN 1 ELSE 0 END),
          0
        ) +
        COALESCE(
          SUM(CASE WHEN fae.data_provenance = 'primary_measured_onsite' THEN 1 ELSE 0 END),
          0
        ) +
        COALESCE(
          SUM(CASE WHEN ude.data_quality = 'actual' THEN 1 ELSE 0 END),
          0
        )
      )::numeric / (COALESCE(COUNT(DISTINCT fae.id), 0) + COALESCE(COUNT(DISTINCT ude.id), 0)) * 100
    )
  END AS average_confidence_score,
  
  -- Confidence rating based on primary data percentage
  CASE
    WHEN (COALESCE(COUNT(DISTINCT fae.id), 0) + COALESCE(COUNT(DISTINCT ude.id), 0)) = 0 THEN 'very_low'
    WHEN (
      (
        COALESCE(
          SUM(CASE WHEN fae.data_provenance = 'primary_supplier_verified' THEN 1 ELSE 0 END),
          0
        ) +
        COALESCE(
          SUM(CASE WHEN fae.data_provenance = 'primary_measured_onsite' THEN 1 ELSE 0 END),
          0
        ) +
        COALESCE(
          SUM(CASE WHEN ude.data_quality = 'actual' THEN 1 ELSE 0 END),
          0
        )
      )::numeric / (COALESCE(COUNT(DISTINCT fae.id), 0) + COALESCE(COUNT(DISTINCT ude.id), 0)) * 100
    ) >= 80 THEN 'high'
    WHEN (
      (
        COALESCE(
          SUM(CASE WHEN fae.data_provenance = 'primary_supplier_verified' THEN 1 ELSE 0 END),
          0
        ) +
        COALESCE(
          SUM(CASE WHEN fae.data_provenance = 'primary_measured_onsite' THEN 1 ELSE 0 END),
          0
        ) +
        COALESCE(
          SUM(CASE WHEN ude.data_quality = 'actual' THEN 1 ELSE 0 END),
          0
        )
      )::numeric / (COALESCE(COUNT(DISTINCT fae.id), 0) + COALESCE(COUNT(DISTINCT ude.id), 0)) * 100
    ) >= 50 THEN 'medium'
    WHEN (
      (
        COALESCE(
          SUM(CASE WHEN fae.data_provenance = 'primary_supplier_verified' THEN 1 ELSE 0 END),
          0
        ) +
        COALESCE(
          SUM(CASE WHEN fae.data_provenance = 'primary_measured_onsite' THEN 1 ELSE 0 END),
          0
        ) +
        COALESCE(
          SUM(CASE WHEN ude.data_quality = 'actual' THEN 1 ELSE 0 END),
          0
        )
      )::numeric / (COALESCE(COUNT(DISTINCT fae.id), 0) + COALESCE(COUNT(DISTINCT ude.id), 0)) * 100
    ) >= 20 THEN 'low'
    ELSE 'very_low'
  END AS confidence_rating
FROM facilities f
LEFT JOIN facility_activity_entries fae
  ON f.id = fae.facility_id
LEFT JOIN utility_data_entries ude
  ON f.id = ude.facility_id
GROUP BY f.id, f.organization_id;
