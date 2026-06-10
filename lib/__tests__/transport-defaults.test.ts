import { describe, it, expect } from 'vitest';
import {
  defaultTransportForOrigin,
  UNKNOWN_ORIGIN_DEFAULT,
} from '@/lib/constants/transport-defaults';
import { mapOpenLcaUnit } from '@/lib/constants/material-units';
import { buildPackagingMaterialData } from '@/lib/products/packaging-material-data';

describe('defaultTransportForOrigin', () => {
  it('uses a domestic road estimate for same-country supply', () => {
    const est = defaultTransportForOrigin({
      originCountryCode: 'GB',
      destinationCountryCode: 'GB',
    });
    expect(est?.mode).toBe('truck');
    expect(est?.distanceKm).toBe(300);
  });

  it('uses road freight within Europe', () => {
    const est = defaultTransportForOrigin({
      originCountryCode: 'DE',
      destinationLat: 51.5,
      destinationLng: -0.1, // London
    });
    expect(est?.mode).toBe('truck');
    expect(est!.distanceKm).toBeGreaterThan(500);
    expect(est!.distanceKm).toBeLessThan(2500);
  });

  it('uses sea freight for intercontinental supply', () => {
    const est = defaultTransportForOrigin({
      originCountryCode: 'BR',
      destinationLat: 51.5,
      destinationLng: -0.1,
    });
    expect(est?.mode).toBe('ship');
    expect(est!.distanceKm).toBeGreaterThan(8000);
  });

  it('returns null for unknown origin countries or missing destination', () => {
    expect(defaultTransportForOrigin({ originCountryCode: 'XX', destinationCountryCode: 'GB' })).toBeNull();
    expect(defaultTransportForOrigin({ originCountryCode: 'GB' })).toBeNull();
  });

  it('conservative fallback is long-haul sea freight', () => {
    expect(UNKNOWN_ORIGIN_DEFAULT.mode).toBe('ship');
    expect(UNKNOWN_ORIGIN_DEFAULT.distanceKm).toBeGreaterThanOrEqual(10000);
  });
});

describe('mapOpenLcaUnit', () => {
  it('maps gdt-server unit names to the vocabulary', () => {
    expect(mapOpenLcaUnit('kg')).toBe('kg');
    expect(mapOpenLcaUnit('l')).toBe('l');
    expect(mapOpenLcaUnit('Item(s)')).toBe('unit');
    expect(mapOpenLcaUnit('p')).toBe('unit');
  });

  it('returns null for units the vocabulary cannot express', () => {
    expect(mapOpenLcaUnit('MJ')).toBeNull();
    expect(mapOpenLcaUnit('m3')).toBeNull();
    expect(mapOpenLcaUnit('tkm')).toBeNull();
    expect(mapOpenLcaUnit(null)).toBeNull();
  });
});

describe('match_status persistence', () => {
  const baseForm: any = {
    tempId: 'temp-1',
    name: 'Glass bottle',
    data_source: null,
    amount: '',
    unit: 'g',
    packaging_category: 'container',
    recycled_content_percentage: '',
    printing_process: 'standard_ink',
    net_weight_g: '480',
    origin_country: '',
    transport_mode: 'truck',
    distance_km: '',
    has_component_breakdown: false,
    components: [],
    epr_is_household: true,
    epr_is_drinks_container: false,
    units_per_group: '',
    reuse_trips: '',
    recyclability_percent: '',
    end_of_life_pathway: '',
    biobased_content_percentage: '',
  };

  it('writes the form value and null for legacy rows', () => {
    expect(buildPackagingMaterialData({ ...baseForm, match_status: 'auto_matched' }, '1').match_status).toBe('auto_matched');
    expect(buildPackagingMaterialData({ ...baseForm, match_status: 'verified' }, '1').match_status).toBe('verified');
    expect(buildPackagingMaterialData(baseForm, '1').match_status).toBeNull();
  });
});
