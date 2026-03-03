import { describe, it, expect } from 'vitest';
import {
  calculateImpactValuation,
  type ImpactValuationInputs,
  type NaturalCapitalInputs,
  type HumanCapitalInputs,
  type SocialCapitalInputs,
  type GovernanceCapitalInputs,
  type ProxyValues,
} from '../impact-valuation';

// ============================================================================
// FIXTURES
// ============================================================================

function defaultProxies(): ProxyValues {
  return {
    carbon_tonne: 86,
    water_m3: 0.05,
    land_ha: 1200,
    waste_tonne: 120,
    living_wage_gap_gbp: 1.5,
    training_hour: 25,
    wellbeing_score_point: 500,
    volunteering_hour: 18,
    charitable_giving_gbp: 1.2,
    local_multiplier: 0.64,
    governance_score_point: 300,
  };
}

function defaultNatural(): NaturalCapitalInputs {
  return {
    total_emissions_tco2e: 100,
    water_consumption_m3: 5000,
    land_use_ha: 10,
    waste_to_landfill_tonnes: 25,
  };
}

function defaultHuman(): HumanCapitalInputs {
  return {
    living_wage_gap_annual_gbp: 8000,
    total_training_hours: 200,
    employee_count: 50,
    wellbeing_score: 72,
  };
}

function defaultSocial(): SocialCapitalInputs {
  return {
    volunteering_hours_total: 150,
    charitable_giving_total_gbp: 10000,
    local_supply_spend_gbp: 50000,
  };
}

function defaultGovernance(): GovernanceCapitalInputs {
  return {
    governance_score: 80,
  };
}

function buildInputs(overrides?: Partial<ImpactValuationInputs>): ImpactValuationInputs {
  return {
    natural: overrides?.natural ?? defaultNatural(),
    human: overrides?.human ?? defaultHuman(),
    social: overrides?.social ?? defaultSocial(),
    governance: overrides?.governance ?? defaultGovernance(),
    proxies: overrides?.proxies ?? defaultProxies(),
    reporting_year: overrides?.reporting_year ?? 2025,
  };
}

function allNullInputs(): ImpactValuationInputs {
  return buildInputs({
    natural: {
      total_emissions_tco2e: null,
      water_consumption_m3: null,
      land_use_ha: null,
      waste_to_landfill_tonnes: null,
    },
    human: {
      living_wage_gap_annual_gbp: null,
      total_training_hours: null,
      employee_count: null,
      wellbeing_score: null,
    },
    social: {
      volunteering_hours_total: null,
      charitable_giving_total_gbp: null,
      local_supply_spend_gbp: null,
    },
    governance: {
      governance_score: null,
    },
  });
}

// ============================================================================
// NATURAL CAPITAL
// ============================================================================

describe('calculateImpactValuation', () => {
  describe('Natural Capital', () => {
    it('multiplies total_emissions_tco2e by carbon_tonne proxy', () => {
      const result = calculateImpactValuation(buildInputs());
      const carbon = result.natural.items[0];

      expect(carbon.key).toBe('carbon_tonne');
      expect(carbon.value).toBe(100 * 86);
      expect(carbon.raw_input).toBe(100);
      expect(carbon.proxy_used).toBe(86);
      expect(carbon.has_data).toBe(true);
    });

    it('multiplies water_consumption_m3 by water_m3 proxy', () => {
      const result = calculateImpactValuation(buildInputs());
      const water = result.natural.items[1];

      expect(water.key).toBe('water_m3');
      expect(water.value).toBe(5000 * 0.05);
      expect(water.raw_input).toBe(5000);
      expect(water.proxy_used).toBe(0.05);
      expect(water.has_data).toBe(true);
    });

    it('multiplies land_use_ha by land_ha proxy', () => {
      const result = calculateImpactValuation(buildInputs());
      const land = result.natural.items[2];

      expect(land.key).toBe('land_ha');
      expect(land.value).toBe(10 * 1200);
      expect(land.raw_input).toBe(10);
      expect(land.proxy_used).toBe(1200);
      expect(land.has_data).toBe(true);
    });

    it('multiplies waste_to_landfill_tonnes by waste_tonne proxy', () => {
      const result = calculateImpactValuation(buildInputs());
      const waste = result.natural.items[3];

      expect(waste.key).toBe('waste_tonne');
      expect(waste.value).toBe(25 * 120);
      expect(waste.raw_input).toBe(25);
      expect(waste.proxy_used).toBe(120);
      expect(waste.has_data).toBe(true);
    });

    it('treats null inputs as 0 value with has_data=false', () => {
      const inputs = buildInputs({
        natural: {
          total_emissions_tco2e: null,
          water_consumption_m3: null,
          land_use_ha: null,
          waste_to_landfill_tonnes: null,
        },
      });
      const result = calculateImpactValuation(inputs);

      for (const item of result.natural.items) {
        expect(item.value).toBe(0);
        expect(item.raw_input).toBeNull();
        expect(item.has_data).toBe(false);
      }
    });

    it('sums all 4 items into natural.total', () => {
      const result = calculateImpactValuation(buildInputs());
      const expected = (100 * 86) + (5000 * 0.05) + (10 * 1200) + (25 * 120);

      expect(result.natural.total).toBe(expected);
      expect(result.natural.items).toHaveLength(4);
    });
  });

  // ============================================================================
  // HUMAN CAPITAL
  // ============================================================================

  describe('Human Capital', () => {
    it('multiplies living_wage_gap by living_wage_gap_gbp proxy', () => {
      const result = calculateImpactValuation(buildInputs());
      const wageGap = result.human.items[0];

      expect(wageGap.key).toBe('living_wage_gap_gbp');
      expect(wageGap.value).toBe(8000 * 1.5);
      expect(wageGap.raw_input).toBe(8000);
      expect(wageGap.proxy_used).toBe(1.5);
      expect(wageGap.has_data).toBe(true);
    });

    it('multiplies total_training_hours by training_hour proxy', () => {
      const result = calculateImpactValuation(buildInputs());
      const training = result.human.items[1];

      expect(training.key).toBe('training_hour');
      expect(training.value).toBe(200 * 25);
      expect(training.raw_input).toBe(200);
      expect(training.proxy_used).toBe(25);
      expect(training.has_data).toBe(true);
    });

    it('multiplies wellbeing_score by wellbeing_score_point proxy', () => {
      const result = calculateImpactValuation(buildInputs());
      const wellbeing = result.human.items[2];

      expect(wellbeing.key).toBe('wellbeing_score_point');
      expect(wellbeing.value).toBe(72 * 500);
      expect(wellbeing.raw_input).toBe(72);
      expect(wellbeing.proxy_used).toBe(500);
      expect(wellbeing.has_data).toBe(true);
    });
  });

  // ============================================================================
  // SOCIAL CAPITAL
  // ============================================================================

  describe('Social Capital', () => {
    it('multiplies volunteering_hours by volunteering_hour proxy', () => {
      const result = calculateImpactValuation(buildInputs());
      const volunteering = result.social.items[0];

      expect(volunteering.key).toBe('volunteering_hour');
      expect(volunteering.value).toBe(150 * 18);
      expect(volunteering.raw_input).toBe(150);
      expect(volunteering.proxy_used).toBe(18);
      expect(volunteering.has_data).toBe(true);
    });

    it('multiplies charitable_giving by charitable_giving_gbp proxy', () => {
      const result = calculateImpactValuation(buildInputs());
      const giving = result.social.items[1];

      expect(giving.key).toBe('charitable_giving_gbp');
      expect(giving.value).toBe(10000 * 1.2);
      expect(giving.raw_input).toBe(10000);
      expect(giving.proxy_used).toBe(1.2);
      expect(giving.has_data).toBe(true);
    });

    it('multiplies local_supply_spend by local_multiplier proxy', () => {
      const result = calculateImpactValuation(buildInputs());
      const local = result.social.items[2];

      expect(local.key).toBe('local_multiplier');
      expect(local.value).toBe(50000 * 0.64);
      expect(local.raw_input).toBe(50000);
      expect(local.proxy_used).toBe(0.64);
      expect(local.has_data).toBe(true);
    });
  });

  // ============================================================================
  // GOVERNANCE CAPITAL
  // ============================================================================

  describe('Governance Capital', () => {
    it('multiplies governance_score by governance_score_point proxy', () => {
      const result = calculateImpactValuation(buildInputs());
      const governance = result.governance.items[0];

      expect(governance.key).toBe('governance_score_point');
      expect(governance.value).toBe(80 * 300);
      expect(governance.raw_input).toBe(80);
      expect(governance.proxy_used).toBe(300);
      expect(governance.has_data).toBe(true);
    });
  });

  // ============================================================================
  // AGGREGATES
  // ============================================================================

  describe('Aggregates', () => {
    it('computes grand_total as sum of all 4 capital totals', () => {
      const result = calculateImpactValuation(buildInputs());

      const naturalTotal = (100 * 86) + (5000 * 0.05) + (10 * 1200) + (25 * 120);
      const humanTotal = (8000 * 1.5) + (200 * 25) + (72 * 500);
      const socialTotal = (150 * 18) + (10000 * 1.2) + (50000 * 0.64);
      const governanceTotal = 80 * 300;

      const expectedGrandTotal = naturalTotal + humanTotal + socialTotal + governanceTotal;

      expect(result.grand_total).toBe(expectedGrandTotal);
      expect(result.grand_total).toBe(
        result.natural.total + result.human.total + result.social.total + result.governance.total
      );
    });

    it('computes data_coverage as fraction of non-null inputs out of 11', () => {
      // All 11 metrics have data (employee_count is NOT included in coverage)
      const result = calculateImpactValuation(buildInputs());
      expect(result.data_coverage).toBe(11 / 11);
      expect(result.data_coverage).toBe(1);
    });

    it('returns confidence_level high when coverage >= 0.8', () => {
      // 9 out of 11 = 0.818... which is >= 0.8
      const inputs = buildInputs({
        natural: {
          total_emissions_tco2e: 100,
          water_consumption_m3: 5000,
          land_use_ha: null,
          waste_to_landfill_tonnes: null,
        },
      });
      const result = calculateImpactValuation(inputs);

      // 9 non-null out of 11
      expect(result.data_coverage).toBeCloseTo(9 / 11);
      expect(result.confidence_level).toBe('high');
    });

    it('returns confidence_level medium when coverage 0.5-0.79', () => {
      // 6 out of 11 = 0.545... which is >= 0.5 and < 0.8
      const inputs = buildInputs({
        natural: {
          total_emissions_tco2e: 100,
          water_consumption_m3: null,
          land_use_ha: null,
          waste_to_landfill_tonnes: null,
        },
        human: {
          living_wage_gap_annual_gbp: null,
          total_training_hours: null,
          employee_count: 50,
          wellbeing_score: 72,
        },
      });
      const result = calculateImpactValuation(inputs);

      // natural: 1, human: 1 (wellbeing_score), social: 3, governance: 1 = 6 of 11
      expect(result.data_coverage).toBeCloseTo(6 / 11);
      expect(result.confidence_level).toBe('medium');
    });

    it('returns confidence_level low when coverage < 0.5', () => {
      // 2 out of 11 = 0.181... which is < 0.5
      const inputs = buildInputs({
        natural: {
          total_emissions_tco2e: 100,
          water_consumption_m3: null,
          land_use_ha: null,
          waste_to_landfill_tonnes: null,
        },
        human: {
          living_wage_gap_annual_gbp: null,
          total_training_hours: null,
          employee_count: null,
          wellbeing_score: null,
        },
        social: {
          volunteering_hours_total: null,
          charitable_giving_total_gbp: null,
          local_supply_spend_gbp: null,
        },
        governance: {
          governance_score: 80,
        },
      });
      const result = calculateImpactValuation(inputs);

      // natural: 1, human: 0, social: 0, governance: 1 = 2 of 11
      expect(result.data_coverage).toBeCloseTo(2 / 11);
      expect(result.confidence_level).toBe('low');
    });

    it('returns all zeros and low confidence when all inputs are null', () => {
      const result = calculateImpactValuation(allNullInputs());

      expect(result.natural.total).toBe(0);
      expect(result.human.total).toBe(0);
      expect(result.social.total).toBe(0);
      expect(result.governance.total).toBe(0);
      expect(result.grand_total).toBe(0);

      expect(result.data_coverage).toBe(0);
      expect(result.confidence_level).toBe('low');

      // Every single item should have value=0 and has_data=false
      const allItems = [
        ...result.natural.items,
        ...result.human.items,
        ...result.social.items,
        ...result.governance.items,
      ];
      for (const item of allItems) {
        expect(item.value).toBe(0);
        expect(item.has_data).toBe(false);
        expect(item.raw_input).toBeNull();
      }

      expect(result.reporting_year).toBe(2025);
    });
  });
});
