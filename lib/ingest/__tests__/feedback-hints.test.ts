import { describe, expect, it } from 'vitest';
import { deriveHints, sanitiseHintValue } from '../feedback-hints';

describe('sanitiseHintValue', () => {
  it('strips control characters and angle brackets', () => {
    expect(sanitiseHintValue('Main\nWinery <script>')).toBe('Main Winery script');
  });

  it('caps strings at 80 characters', () => {
    expect(String(sanitiseHintValue('x'.repeat(200)))).toHaveLength(80);
  });

  it('passes finite numbers and rejects everything else', () => {
    expect(sanitiseHintValue(30)).toBe(30);
    expect(sanitiseHintValue(Infinity)).toBeNull();
    expect(sanitiseHintValue({ nested: true })).toBeNull();
    expect(sanitiseHintValue('')).toBeNull();
  });
});

describe('deriveHints', () => {
  it('extracts utility bill hints from entries and context', () => {
    const hints = deriveHints(
      'utility_bill',
      { entries: [{ utility_type: 'electricity_grid', unit: 'kWh', quantity: 1500 }] },
      { facility_name: 'Main Winery' },
    );
    expect(hints).toEqual({
      facility_name: 'Main Winery',
      primary_utility_type: 'electricity_grid',
      unit: 'kWh',
    });
  });

  it('prefers the user-corrected category on supplier invoices', () => {
    const hints = deriveHints('supplier_invoice', {
      category: 'capital_goods',
      suggested_category: 'purchased_services',
      currency: 'GBP',
    });
    expect(hints.category).toBe('capital_goods');
    expect(hints.currency).toBe('GBP');
  });

  it('only emits allowlisted keys', () => {
    const hints = deriveHints('freight_invoice', {
      transport_mode: 'ship',
      currency: 'EUR',
      carrier_name: 'Maersk',
      amount: 999,
    });
    expect(Object.keys(hints).sort()).toEqual(['currency', 'transport_mode']);
  });

  it('extracts soil lab hints from the first sample and context', () => {
    const hints = deriveHints(
      'soil_carbon_lab',
      { samples: [{ soc_input_method: 'concentration', depth_cm: 30 }] },
      { asset_kind: 'vineyard', asset_name: 'Home Block' },
    );
    expect(hints).toEqual({
      asset_kind: 'vineyard',
      asset_name: 'Home Block',
      soc_input_method: 'concentration',
      default_depth_cm: 30,
    });
  });

  it('returns an empty object for unknown types and malformed payloads', () => {
    expect(deriveHints('historical_lca_report', { product_name: 'Gin' })).toEqual({});
    expect(deriveHints('utility_bill', { entries: 'not-an-array' } as never)).toEqual({});
  });
});
