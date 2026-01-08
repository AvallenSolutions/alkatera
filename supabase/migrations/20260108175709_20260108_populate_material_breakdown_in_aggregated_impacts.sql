/*
  # Populate Material Breakdown in Aggregated Impacts

  Populates the `breakdown.by_material` field in product_lcas.aggregated_impacts
  by aggregating data from product_lca_materials table. This ensures the Material
  Impact Hotspots card displays correctly by having material-level emissions data
  available in the aggregated_impacts JSON structure.
  
  ## Changes
  - Creates a function to build material breakdown array from product_lca_materials
  - Updates all completed product LCAs to include material breakdown
*/

-- Create function to build material breakdown
CREATE OR REPLACE FUNCTION build_material_breakdown(p_lca_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_materials jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'name', COALESCE(material_name, name, 'Unknown Material'),
      'category', COALESCE(material_type, 'ingredient'),
      'quantity', COALESCE(quantity::float, 0),
      'unit', COALESCE(unit, unit_name, 'kg'),
      'emissions', COALESCE(impact_climate::float, 0),
      'dataSource', COALESCE(data_source, 'secondary_modelled')
    )
    ORDER BY COALESCE(impact_climate::float, 0) DESC
  )
  INTO v_materials
  FROM product_lca_materials
  WHERE product_lca_id = p_lca_id
    AND impact_climate IS NOT NULL
    AND impact_climate::float > 0;
  
  RETURN COALESCE(v_materials, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Update all completed LCAs with material breakdown
UPDATE product_lcas
SET aggregated_impacts = jsonb_set(
  COALESCE(aggregated_impacts, '{}'::jsonb),
  '{breakdown,by_material}',
  build_material_breakdown(id),
  true
)
WHERE status = 'completed'
  AND id IN (
    SELECT DISTINCT product_lca_id 
    FROM product_lca_materials 
    WHERE impact_climate IS NOT NULL 
      AND impact_climate::float > 0
  );
