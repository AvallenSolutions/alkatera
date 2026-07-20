import { describe, it, expect } from 'vitest';
import { mapFacilities, toTonnes, type FacilitiesRaw, type FacilityRow } from '../facilities';

const facility = (over: Partial<FacilityRow>): FacilityRow => ({
  id: 'fac-1',
  name: 'Main Distillery',
  type_name: 'Distillery',
  location: null,
  address_city: null,
  address_country: null,
  location_city: null,
  location_country_code: null,
  ...over,
});

describe('toTonnes — the kg→tonnes guard', () => {
  it('divides by 1000 only when the unit says kg: 12500 kg → 12.5', () => {
    expect(toTonnes(12500, 'kg CO₂e')).toBe(12.5);
    expect(toTonnes(12500, 'kg')).toBe(12.5);
    expect(toTonnes(12500, 'kgCO2e')).toBe(12.5);
    expect(toTonnes(12500, 'KG CO2E')).toBe(12.5);
  });

  it('passes tonnes through untouched', () => {
    expect(toTonnes(12.5, 'tonnes CO₂e')).toBe(12.5);
    expect(toTonnes(12.5, 't')).toBe(12.5);
    expect(toTonnes(12.5, 'tCO2e')).toBe(12.5);
  });

  it('treats a missing unit as kg (the column default and source pipeline are kg)', () => {
    expect(toTonnes(12500, null)).toBe(12.5);
    expect(toTonnes(12500, '')).toBe(12.5);
  });
});

describe('mapFacilities', () => {
  it('converts a 12500 kg row to 12.5 tonnes on the payload', () => {
    const raw: FacilitiesRaw = {
      facilities: [facility({})],
      emissions: [{ facility_id: 'fac-1', total_co2e: 12500, unit: 'kg CO₂e' }],
      production: [],
    };
    const out = mapFacilities(raw);
    expect(out[0].totalEmissions).toBe(12.5);
    expect(out[0].hasData).toBe(true);
  });

  it('sums mixed-unit rows per facility, each guarded on its own unit', () => {
    const raw: FacilitiesRaw = {
      facilities: [facility({})],
      emissions: [
        { facility_id: 'fac-1', total_co2e: 12500, unit: 'kg CO₂e' }, // 12.5 t
        { facility_id: 'fac-1', total_co2e: 2.5, unit: 'tonnes CO₂e' }, // 2.5 t
      ],
      production: [],
    };
    expect(mapFacilities(raw)[0].totalEmissions).toBe(15);
  });

  it('leaves an unmeasured facility null with hasData false, never 0', () => {
    const raw: FacilitiesRaw = {
      facilities: [facility({ id: 'fac-2', name: 'Warehouse' })],
      emissions: [],
      production: [],
    };
    const out = mapFacilities(raw);
    expect(out[0].totalEmissions).toBeNull();
    expect(out[0].unitsProduced).toBeNull();
    expect(out[0].hasData).toBe(false);
  });

  it('does not leak one facility\'s data onto another', () => {
    const raw: FacilitiesRaw = {
      facilities: [facility({ id: 'a', name: 'Site A' }), facility({ id: 'b', name: 'Site B' })],
      emissions: [{ facility_id: 'a', total_co2e: 3000, unit: 'kg CO₂e' }],
      production: [{ facility_id: 'a', production_volume: 5000 }],
    };
    const out = mapFacilities(raw);
    const a = out.find((f) => f.name === 'Site A')!;
    const b = out.find((f) => f.name === 'Site B')!;
    expect(a.totalEmissions).toBe(3);
    expect(a.unitsProduced).toBe(5000);
    expect(a.hasData).toBe(true);
    expect(b.totalEmissions).toBeNull();
    expect(b.unitsProduced).toBeNull();
    expect(b.hasData).toBe(false);
  });

  it('sums production volumes across overlapping periods', () => {
    const raw: FacilitiesRaw = {
      facilities: [facility({})],
      emissions: [],
      production: [
        { facility_id: 'fac-1', production_volume: 1000 },
        { facility_id: 'fac-1', production_volume: 250 },
      ],
    };
    const out = mapFacilities(raw);
    expect(out[0].unitsProduced).toBe(1250);
    // Production alone is not emissions measurement.
    expect(out[0].hasData).toBe(false);
    expect(out[0].totalEmissions).toBeNull();
  });

  it('builds a readable location and falls back through the address columns', () => {
    const withFreeText = facility({ location: 'Bristol, UK' });
    const withAddress = facility({ id: 'x', address_city: 'Leeds', address_country: 'United Kingdom' });
    const withGeo = facility({ id: 'y', location_city: 'Porto', location_country_code: 'PT' });
    const bare = facility({ id: 'z' });
    const out = mapFacilities({
      facilities: [withFreeText, withAddress, withGeo, bare],
      emissions: [],
      production: [],
    });
    expect(out[0].location).toBe('Bristol, UK');
    expect(out[1].location).toBe('Leeds, United Kingdom');
    expect(out[2].location).toBe('Porto, PT');
    expect(out[3].location).toBe('');
    expect(out[3].type).toBe('Distillery');
  });
});
