/*
  # Recreate facility confidence summary view

  Drops and recreates the facility_confidence_summary view to fix data quality
  metrics calculation for the Data Quality Confidence card.
*/

DROP VIEW IF EXISTS facility_confidence_summary CASCADE;

CREATE VIEW facility_confidence_summary AS
SELECT
  f.id AS facility_id,
  f.organization_id,
  COALESCE(COUNT(fae.id), 0) AS total_entries,
  COALESCE(
    SUM(CASE WHEN fae.data_provenance = 'primary_supplier_verified' THEN 1 ELSE 0 END),
    0
  ) AS primary_verified_count,
  COALESCE(
    SUM(CASE WHEN fae.data_provenance = 'primary_measured_onsite' THEN 1 ELSE 0 END),
    0
  ) AS primary_measured_count,
  COALESCE(
    SUM(CASE WHEN fae.data_provenance = 'secondary_modelled_industry_average' THEN 1 ELSE 0 END),
    0
  ) AS secondary_modelled_count,
  COALESCE(
    SUM(CASE WHEN fae.data_provenance = 'secondary_calculated_allocation' THEN 1 ELSE 0 END),
    0
  ) AS secondary_allocated_count,
  CASE
    WHEN COUNT(fae.id) = 0 THEN 0
    ELSE (
      (
        COALESCE(
          SUM(CASE WHEN fae.data_provenance = 'primary_supplier_verified' THEN 1 ELSE 0 END),
          0
        ) +
        COALESCE(
          SUM(CASE WHEN fae.data_provenance = 'primary_measured_onsite' THEN 1 ELSE 0 END),
          0
        )
      )::numeric / COUNT(fae.id) * 100
    )
  END AS primary_data_percentage,
  CASE
    WHEN COUNT(fae.id) = 0 THEN 0
    ELSE (
      (
        COALESCE(
          SUM(CASE WHEN fae.data_provenance = 'primary_supplier_verified' THEN 1 ELSE 0 END),
          0
        ) +
        COALESCE(
          SUM(CASE WHEN fae.data_provenance = 'primary_measured_onsite' THEN 1 ELSE 0 END),
          0
        )
      )::numeric / COUNT(fae.id) * 100
    )
  END AS average_confidence_score,
  CASE
    WHEN COUNT(fae.id) = 0 THEN 'very_low'
    WHEN (
      (
        COALESCE(
          SUM(CASE WHEN fae.data_provenance = 'primary_supplier_verified' THEN 1 ELSE 0 END),
          0
        ) +
        COALESCE(
          SUM(CASE WHEN fae.data_provenance = 'primary_measured_onsite' THEN 1 ELSE 0 END),
          0
        )
      )::numeric / COUNT(fae.id) * 100
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
        )
      )::numeric / COUNT(fae.id) * 100
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
        )
      )::numeric / COUNT(fae.id) * 100
    ) >= 20 THEN 'low'
    ELSE 'very_low'
  END AS confidence_rating
FROM facilities f
LEFT JOIN facility_activity_entries fae
  ON f.id = fae.facility_id
GROUP BY f.id, f.organization_id;
