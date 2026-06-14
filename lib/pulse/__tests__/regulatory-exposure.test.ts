import { describe, it, expect } from 'vitest';
import { calculateRegulatoryExposure } from '../regulatory-exposure';

const line = (r: ReturnType<typeof calculateRegulatoryExposure>, id: string) =>
  r.lines.find((l) => l.id === id)!;

describe('calculateRegulatoryExposure — eligibility gating', () => {
  it('does not charge UK ETS unless the org is a covered installation', () => {
    const r = calculateRegulatoryExposure({ annual_tonnes_co2e: 330 });
    const ets = line(r, 'uk_ets');
    expect(ets.applies).toBe(false);
    expect(ets.annual_cost_gbp).toBe(0);
    expect(ets.basis).toMatch(/not in scope/i);
  });

  it('charges UK ETS only when explicitly covered', () => {
    const r = calculateRegulatoryExposure({ annual_tonnes_co2e: 330, uk_ets_covered: true });
    const ets = line(r, 'uk_ets');
    expect(ets.applies).toBe(true);
    expect(ets.annual_cost_gbp).toBeGreaterThan(0);
  });

  it('exempts Plastic Packaging Tax below the 10 t/year threshold', () => {
    const r = calculateRegulatoryExposure({ annual_tonnes_co2e: 0, plastic_packaging_tonnes: 4 });
    const ppt = line(r, 'plastic_tax');
    expect(ppt.applies).toBe(false);
    expect(ppt.annual_cost_gbp).toBe(0);
  });

  it('charges Plastic Packaging Tax at/above 10 t (net of recycled share)', () => {
    const r = calculateRegulatoryExposure({ annual_tonnes_co2e: 0, plastic_packaging_tonnes: 20, plastic_recycled_share: 0.5 });
    const ppt = line(r, 'plastic_tax');
    expect(ppt.applies).toBe(true);
    expect(ppt.annual_cost_gbp).toBeGreaterThan(0);
  });

  it('exempts EPR below 25 t of packaging', () => {
    const r = calculateRegulatoryExposure({ annual_tonnes_co2e: 0, packaging_by_material_t: { glass: 10 } });
    const epr = line(r, 'epr');
    expect(epr.applies).toBe(false);
    expect(epr.basis).toMatch(/exempt/i);
  });

  it('treats 25–50 t as a small producer with no disposal fees', () => {
    const r = calculateRegulatoryExposure({ annual_tonnes_co2e: 0, packaging_by_material_t: { glass: 30 } });
    const epr = line(r, 'epr');
    expect(epr.applies).toBe(false);
    expect(epr.annual_cost_gbp).toBe(0);
    expect(epr.basis).toMatch(/small producer/i);
  });

  it('charges EPR fees for a large producer (>=50 t, turnover unknown)', () => {
    const r = calculateRegulatoryExposure({ annual_tonnes_co2e: 0, packaging_by_material_t: { glass: 60, aluminium: 5 } });
    const epr = line(r, 'epr');
    expect(epr.applies).toBe(true);
    expect(epr.annual_cost_gbp).toBeGreaterThan(0);
  });

  it('keeps a high-tonnage producer EXEMPT when turnover is below £1m', () => {
    const r = calculateRegulatoryExposure({
      annual_tonnes_co2e: 0,
      packaging_by_material_t: { glass: 80 },
      annual_turnover_gbp: 600_000,
    });
    const epr = line(r, 'epr');
    expect(epr.applies).toBe(false);
    expect(epr.annual_cost_gbp).toBe(0);
  });
});
