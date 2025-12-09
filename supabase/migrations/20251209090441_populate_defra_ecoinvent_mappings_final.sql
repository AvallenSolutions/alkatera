/*
  # Populate DEFRA-Ecoinvent Impact Mappings (Final)

  ## Overview
  This migration populates the defra_ecoinvent_impact_mappings table with mappings
  for common UK emission factors from DEFRA 2025 to corresponding Ecoinvent 3.12 processes.

  ## Mapping Categories
  - ENERGY: Scope 1 & 2 (electricity, natural gas, diesel, coal)
  - TRANSPORT: Scope 3 freight (HGV, rail, sea, air)
  - COMMUTING: Scope 3 employee travel (car, bus, rail, air)

  ## Mapping Quality Levels
  - EXACT: Direct 1:1 match between DEFRA and Ecoinvent
  - CLOSE: Very similar process with minor differences
  - GENERIC: Broader category match requiring adjustments
*/

-- =====================================================
-- SECTION 1: ENERGY MAPPINGS (SCOPE 1 & 2)
-- =====================================================

INSERT INTO public.defra_ecoinvent_impact_mappings (
  defra_factor_name,
  defra_category,
  defra_scope,
  ecoinvent_proxy_category,
  ecoinvent_proxy_name,
  mapping_quality,
  geographic_alignment,
  confidence_score,
  notes
) VALUES
  -- UK Grid Electricity
  (
    'Electricity (Grid - UK)',
    'ENERGY',
    'Scope 2',
    'electricity_grid_gb',
    'Electricity, grid mix (Great Britain)',
    'EXACT',
    'UK',
    95,
    'Direct match: DEFRA UK grid average matches Ecoinvent GB grid mix. Both use same geographic boundary and temporal scope.'
  ),
  
  -- Natural Gas
  (
    'Natural Gas (Heat)',
    'ENERGY',
    'Scope 1',
    'natural_gas_heat',
    'Natural gas, burned for heat',
    'EXACT',
    'GLO',
    90,
    'Direct combustion process. Ecoinvent provides global average which is appropriate for UK natural gas combustion.'
  ),
  
  -- Diesel (stationary combustion)
  (
    'Diesel (Stationary Combustion)',
    'ENERGY',
    'Scope 1',
    'diesel_combustion_stationary',
    'Diesel, burned in industrial boiler',
    'CLOSE',
    'EU',
    85,
    'Ecoinvent European diesel combustion is appropriate proxy for UK stationary diesel use.'
  ),
  
  -- Coal
  (
    'Coal (Industrial)',
    'ENERGY',
    'Scope 1',
    'coal_combustion_industrial',
    'Hard coal, burned in industrial furnace',
    'CLOSE',
    'EU',
    80,
    'Ecoinvent European coal combustion appropriate for UK industrial coal burning. Limited UK coal use in 2025.'
  );

-- =====================================================
-- SECTION 2: FREIGHT TRANSPORT MAPPINGS (SCOPE 3)
-- =====================================================

INSERT INTO public.defra_ecoinvent_impact_mappings (
  defra_factor_name,
  defra_category,
  defra_scope,
  ecoinvent_proxy_category,
  ecoinvent_proxy_name,
  mapping_quality,
  geographic_alignment,
  confidence_score,
  notes
) VALUES
  -- HGV Freight (Average Laden)
  (
    'Transport (HGV Diesel)',
    'TRANSPORT',
    'Scope 3',
    'transport_hgv_diesel',
    'Transport, freight, lorry (HGV diesel)',
    'EXACT',
    'EU',
    90,
    'DEFRA HGV average laden matches Ecoinvent Euro 5/6 HGV. Both expressed in tkm. EU-27 data appropriate for UK.'
  ),
  
  -- Rail Freight
  (
    'Rail Freight (UK)',
    'TRANSPORT',
    'Scope 3',
    'transport_freight_train',
    'Transport, freight, train (diesel and electric)',
    'CLOSE',
    'EU',
    85,
    'UK rail freight uses mix of diesel and electric traction. Ecoinvent EU mix is appropriate proxy.'
  ),
  
  -- Sea Freight (Container Ship)
  (
    'Sea Freight (Container Ship)',
    'TRANSPORT',
    'Scope 3',
    'transport_sea_freight',
    'Transport, freight, sea, container ship',
    'EXACT',
    'GLO',
    90,
    'International shipping uses global average. Both DEFRA and Ecoinvent use similar vessel assumptions and tkm basis.'
  ),
  
  -- Air Freight
  (
    'Air Freight (Average)',
    'TRANSPORT',
    'Scope 3',
    'transport_air_freight',
    'Transport, freight, aircraft',
    'CLOSE',
    'GLO',
    85,
    'DEFRA uses RFI-adjusted values. Ecoinvent provides freight-only aircraft. Mapping includes both cargo and passenger belly hold.'
  );

-- =====================================================
-- SECTION 3: COMMUTING TRANSPORT MAPPINGS (SCOPE 3)
-- =====================================================

INSERT INTO public.defra_ecoinvent_impact_mappings (
  defra_factor_name,
  defra_category,
  defra_scope,
  ecoinvent_proxy_category,
  ecoinvent_proxy_name,
  mapping_quality,
  geographic_alignment,
  confidence_score,
  notes
) VALUES
  -- Passenger Car - Diesel
  (
    'Passenger Car (Diesel)',
    'COMMUTING',
    'Scope 3',
    'transport_car_diesel',
    'Transport, passenger car, diesel (Euro 5)',
    'EXACT',
    'EU',
    90,
    'DEFRA medium diesel car matches Ecoinvent Euro 5 diesel passenger car. Both UK and EU have similar vehicle standards.'
  ),
  
  -- Passenger Car - Petrol
  (
    'Passenger Car (Petrol)',
    'COMMUTING',
    'Scope 3',
    'transport_car_petrol',
    'Transport, passenger car, petrol (Euro 5)',
    'EXACT',
    'EU',
    90,
    'DEFRA medium petrol car matches Ecoinvent Euro 5 petrol passenger car. Vehicle performance similar across UK/EU.'
  ),
  
  -- Bus (Local/Average)
  (
    'Bus (Local Average)',
    'COMMUTING',
    'Scope 3',
    'transport_bus',
    'Transport, regular bus',
    'CLOSE',
    'EU',
    85,
    'UK local bus services match Ecoinvent European average bus. Occupancy rates similar.'
  ),
  
  -- National Rail
  (
    'National Rail (UK)',
    'COMMUTING',
    'Scope 3',
    'transport_rail_passenger',
    'Transport, passenger, train (diesel and electric)',
    'CLOSE',
    'EU',
    85,
    'UK National Rail uses 30% diesel, 70% electric. Ecoinvent EU mix is appropriate proxy with similar electricity grid mix.'
  ),
  
  -- London Underground
  (
    'London Underground',
    'COMMUTING',
    'Scope 3',
    'transport_metro',
    'Transport, passenger, metro (electric)',
    'CLOSE',
    'EU',
    80,
    'London Underground is 100% electric. Ecoinvent metro uses European electricity mix. Adjust for UK grid intensity.'
  ),
  
  -- Air Travel - Domestic
  (
    'Air Travel (Domestic)',
    'COMMUTING',
    'Scope 3',
    'transport_air_passenger_short',
    'Transport, passenger, aircraft, short haul',
    'CLOSE',
    'GLO',
    85,
    'DEFRA domestic (<500 km) matches Ecoinvent short haul (<1000 km). Both include RFI for non-CO2 effects.'
  ),
  
  -- Air Travel - Short Haul
  (
    'Air Travel (Short Haul)',
    'COMMUTING',
    'Scope 3',
    'transport_air_passenger_medium',
    'Transport, passenger, aircraft, medium haul',
    'CLOSE',
    'GLO',
    85,
    'DEFRA short haul (500-3700 km) maps to Ecoinvent medium haul (1000-3000 km). Similar aircraft types and load factors.'
  ),
  
  -- Air Travel - Long Haul
  (
    'Air Travel (Long Haul)',
    'COMMUTING',
    'Scope 3',
    'transport_air_passenger_long',
    'Transport, passenger, aircraft, long haul',
    'EXACT',
    'GLO',
    90,
    'DEFRA long haul (>3700 km) matches Ecoinvent long haul (>3000 km). Both use wide-body aircraft assumptions.'
  );

-- =====================================================
-- SECTION 4: VERIFICATION
-- =====================================================

DO $$
DECLARE
  total_mappings INTEGER;
  energy_mappings INTEGER;
  transport_mappings INTEGER;
  commuting_mappings INTEGER;
  exact_mappings INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_mappings FROM public.defra_ecoinvent_impact_mappings;
  SELECT COUNT(*) INTO energy_mappings FROM public.defra_ecoinvent_impact_mappings WHERE defra_category = 'ENERGY';
  SELECT COUNT(*) INTO transport_mappings FROM public.defra_ecoinvent_impact_mappings WHERE defra_category = 'TRANSPORT';
  SELECT COUNT(*) INTO commuting_mappings FROM public.defra_ecoinvent_impact_mappings WHERE defra_category = 'COMMUTING';
  SELECT COUNT(*) INTO exact_mappings FROM public.defra_ecoinvent_impact_mappings WHERE mapping_quality = 'EXACT';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'DEFRA-Ecoinvent Mappings Population Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total mappings created: %', total_mappings;
  RAISE NOTICE '  ENERGY (Scope 1 & 2): %', energy_mappings;
  RAISE NOTICE '  TRANSPORT (Scope 3): %', transport_mappings;
  RAISE NOTICE '  COMMUTING (Scope 3): %', commuting_mappings;
  RAISE NOTICE 'EXACT quality mappings: %', exact_mappings;
  RAISE NOTICE '';
  RAISE NOTICE 'Hybrid calculation now enabled for:';
  RAISE NOTICE '  ✓ UK electricity and fuels';
  RAISE NOTICE '  ✓ Freight transport (HGV, rail, sea, air)';
  RAISE NOTICE '  ✓ Employee commuting (car, bus, rail, air)';
  RAISE NOTICE '';
  RAISE NOTICE 'System will use:';
  RAISE NOTICE '  • DEFRA 2025 factors for GHG (CO2e) calculations';
  RAISE NOTICE '  • Ecoinvent 3.12 proxies for environmental impacts';
  RAISE NOTICE '  • Dual provenance tracking for transparency';
  RAISE NOTICE '========================================';
END $$;
