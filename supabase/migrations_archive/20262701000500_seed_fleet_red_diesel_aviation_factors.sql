-- Seed DEFRA 2025 mobile-combustion factors for red/agricultural diesel and
-- aviation fuel, used by the fleet module (calculate-fleet-emissions looks
-- these up by exact name via ILIKE). Idempotent: only inserts if absent.

INSERT INTO public.emissions_factors
  (name, value, unit, source, source_documentation_link,
   year_of_publication, geographic_scope, category, subcategory, fuel_type)
SELECT v.name, v.value, v.unit, v.source, v.link,
       v.yr, v.geo, v.cat, v.subcat, v.fuel
FROM (VALUES
  ('Gas Oil (Red Diesel) - Mobile Combustion', 2.66076::numeric, 'kgCO2e/litre',
   'DEFRA 2025',
   'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
   2025, 'UK', 'Scope 1', 'Mobile Combustion', 'red_diesel'),
  ('Aviation Turbine Fuel - Mobile Combustion', 2.54470::numeric, 'kgCO2e/litre',
   'DEFRA 2025',
   'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025',
   2025, 'UK', 'Scope 1', 'Mobile Combustion', 'aviation')
) AS v(name, value, unit, source, link, yr, geo, cat, subcat, fuel)
WHERE NOT EXISTS (
  SELECT 1 FROM public.emissions_factors e WHERE e.name = v.name
);
