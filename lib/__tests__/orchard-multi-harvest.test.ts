import { describe, it, expect } from 'vitest';
import { calculateMultiHarvestAverage } from '../orchard-multi-harvest';
import type { OrchardCalculatorInput } from '../types/orchard';

const BASE_INPUT: OrchardCalculatorInput = {
  orchard_type: 'apple',
  climate_zone: 'temperate',
  certification: 'organic',
  location_country_code: 'FR',
  area_ha: 15,
  soil_management: 'cover_cropping',
  pruning_residue_returned: true,
  fertiliser_type: 'organic_compost',
  fertiliser_quantity_kg: 5000,
  fertiliser_n_content_percent: 1.5,
  uses_pesticides: true,
  pesticide_applications_per_year: 4,
  pesticide_type: 'sulfur',
  uses_herbicides: false,
  herbicide_applications_per_year: 0,
  diesel_litres_per_year: 800,
  petrol_litres_per_year: 50,
  is_irrigated: false,
  water_m3_per_ha: 0,
  irrigation_energy_source: 'none',
  fruit_yield_tonnes: 30,
  soil_carbon_override_kg_co2e_per_ha: null,
  transport_distance_km: 25,
  transport_mode: 'road',
  harvest_year: 2025,
};

describe('calculateMultiHarvestAverage: perennial biomass carbon pass-through', () => {
  it('should preserve biomass_carbon fields in averaged result when age is known', () => {
    const result = calculateMultiHarvestAverage([
      { harvest_year: 2023, input: { ...BASE_INPUT, tree_age: 8 } },
      { harvest_year: 2024, input: { ...BASE_INPUT, tree_age: 9 } },
      { harvest_year: 2025, input: { ...BASE_INPUT, tree_age: 10 } },
    ]);

    expect(result.averaged_impacts.flag_removals.biomass_carbon_co2e).toBeGreaterThan(0);
    expect(result.averaged_impacts.flag_removals.biomass_carbon_methodology).toBe('age_based_default');
    expect(result.averaged_impacts.flag_removals.biomass_carbon_warning).toBeUndefined();
  });

  it('should preserve warning when tree_age is missing across all harvests', () => {
    const result = calculateMultiHarvestAverage([
      { harvest_year: 2024, input: BASE_INPUT },
      { harvest_year: 2025, input: BASE_INPUT },
    ]);
    expect(result.averaged_impacts.flag_removals.biomass_carbon_co2e).toBe(0);
    expect(result.averaged_impacts.flag_removals.biomass_carbon_methodology).toBe('not_calculated');
    expect(result.averaged_impacts.flag_removals.biomass_carbon_warning).toBeDefined();
    expect(result.averaged_impacts.flag_removals.biomass_carbon_warning).toContain('planting year');
  });

  it('should include biomass removal in total_removals of averaged result', () => {
    const result = calculateMultiHarvestAverage([
      { harvest_year: 2024, input: { ...BASE_INPUT, tree_age: 4 } },
      { harvest_year: 2025, input: { ...BASE_INPUT, tree_age: 5 } },
    ]);
    expect(result.averaged_impacts.total_removals).toBeCloseTo(
      result.averaged_impacts.flag_removals.soil_carbon_co2e +
        result.averaged_impacts.flag_removals.biomass_carbon_co2e,
      4
    );
  });

  it('should pass through biomass fields for a single-harvest result', () => {
    const result = calculateMultiHarvestAverage([
      { harvest_year: 2025, input: { ...BASE_INPUT, tree_age: 10 } },
    ]);
    expect(result.averaged_impacts.flag_removals.biomass_carbon_co2e).toBeGreaterThan(0);
    expect(result.averaged_impacts.flag_removals.biomass_carbon_methodology).toBe('age_based_default');
  });

  it('should never net biomass removal against emissions in averaged result', () => {
    const result = calculateMultiHarvestAverage([
      { harvest_year: 2024, input: { ...BASE_INPUT, tree_age: 4 } },
      { harvest_year: 2025, input: { ...BASE_INPUT, tree_age: 5 } },
    ]);
    const manualEmissions =
      result.averaged_impacts.flag_emissions.total_flag_co2e +
      result.averaged_impacts.non_flag_emissions.total_non_flag_co2e;
    expect(result.averaged_impacts.total_emissions).toBeCloseTo(manualEmissions, 2);
  });
});
