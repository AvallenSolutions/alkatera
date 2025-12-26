/*
  # Backfill Units Produced in Production Logs

  ## Issue
  Existing production logs have volume in hectolitres but units_produced is NULL.
  Category 1 calculations are multiplying per-unit emissions by hectolitres, creating
  massively inflated totals.

  ## Fix
  Calculate units_produced for all existing production logs based on:
  - Product unit size (e.g., 700ml bottle)
  - Bulk volume logged (hectolitres)
  - Conversion: 1 hectolitre = 100 litres

  Example: 750 hectolitres of 700ml bottles
  - 750 hl = 75,000 litres
  - 75,000 L ÷ 0.7 L/bottle = 107,143 bottles
*/

-- Update all production logs to calculate units_produced
UPDATE production_logs pl
SET 
  units_produced = (
    -- Convert volume to litres
    CASE 
      WHEN pl.unit ILIKE '%hectolitre%' OR pl.unit ILIKE 'hl' THEN pl.volume * 100
      WHEN pl.unit ILIKE '%litre%' OR pl.unit ILIKE 'l' THEN pl.volume
      ELSE pl.volume
    END
  ) / (
    -- Divide by product unit size in litres
    CASE
      WHEN p.unit_size_unit = 'ml' THEN p.unit_size_value / 1000.0
      WHEN p.unit_size_unit = 'l' THEN p.unit_size_value
      ELSE p.unit_size_value
    END
  ),
  conversion_factor = (
    CASE 
      WHEN pl.unit ILIKE '%hectolitre%' OR pl.unit ILIKE 'hl' THEN pl.volume * 100
      WHEN pl.unit ILIKE '%litre%' OR pl.unit ILIKE 'l' THEN pl.volume
      ELSE pl.volume
    END
  ) / (
    CASE
      WHEN p.unit_size_unit = 'ml' THEN p.unit_size_value / 1000.0
      WHEN p.unit_size_unit = 'l' THEN p.unit_size_value
      ELSE p.unit_size_value
    END
  ) / NULLIF(pl.volume, 0)
FROM products p
WHERE pl.product_id = p.id
  AND pl.units_produced IS NULL
  AND p.unit_size_value IS NOT NULL;

-- Verify the update
SELECT 
  'Backfill Complete' as status,
  COUNT(*) as total_logs_updated,
  SUM(units_produced) as total_units_produced
FROM production_logs
WHERE units_produced IS NOT NULL;

-- Show corrected production logs for TEST products
SELECT 
  p.name as product_name,
  pl.date,
  pl.volume as old_volume_hl,
  pl.units_produced as bottles_produced,
  ROUND(pl.units_produced * lca.total_ghg_emissions::numeric, 2) as total_emissions_kg,
  ROUND(pl.units_produced * lca.total_ghg_emissions::numeric / 1000, 3) as total_emissions_tonnes
FROM production_logs pl
JOIN products p ON p.id = pl.product_id
JOIN product_lcas lca ON lca.id = p.latest_lca_id
WHERE p.name LIKE 'TEST %'
ORDER BY p.name, pl.date;
