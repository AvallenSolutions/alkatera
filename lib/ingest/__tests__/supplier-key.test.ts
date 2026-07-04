import { describe, expect, it } from 'vitest';
import { normaliseSupplierKey, supplierKeyForResult } from '../supplier-key';

describe('normaliseSupplierKey', () => {
  it('lowercases, strips punctuation and drops legal suffixes', () => {
    expect(normaliseSupplierKey('British Gas Ltd.')).toBe('british gas');
    expect(normaliseSupplierKey('Veolia UK Limited')).toBe('veolia');
    expect(normaliseSupplierKey('Thames Water PLC')).toBe('thames water');
  });

  it('strips diacritics', () => {
    expect(normaliseSupplierKey('Château Margaux')).toBe('chateau margaux');
    expect(normaliseSupplierKey('Müller GmbH')).toBe('muller');
  });

  it('keeps a lone legal token rather than emptying the key', () => {
    expect(normaliseSupplierKey('Limited')).toBe('limited');
  });

  it('returns null for empty or symbol-only input', () => {
    expect(normaliseSupplierKey('')).toBeNull();
    expect(normaliseSupplierKey('   ')).toBeNull();
    expect(normaliseSupplierKey('***')).toBeNull();
  });

  it('caps very long names at 120 characters', () => {
    const key = normaliseSupplierKey('a'.repeat(300));
    expect(key).toHaveLength(120);
  });
});

describe('supplierKeyForResult', () => {
  it('reads the type-specific source field', () => {
    expect(supplierKeyForResult('freight_invoice', { carrier_name: 'DHL Express' }, {})).toBe('dhl express');
    expect(supplierKeyForResult('certification', { issuer: 'B Lab' }, {})).toBe('b lab');
    expect(supplierKeyForResult('soil_carbon_lab', { lab_name: 'Eurofins Ltd' }, {})).toBe('eurofins');
  });

  it('prefers the saved value but falls back to the classifier value', () => {
    expect(supplierKeyForResult('utility_bill', { supplier_name: 'Octopus Energy' }, { supplier_name: 'Octopus' })).toBe(
      'octopus energy',
    );
    expect(supplierKeyForResult('utility_bill', {}, { supplier_name: 'British Gas' })).toBe('british gas');
  });

  it('returns null for types without a supplier field', () => {
    expect(supplierKeyForResult('packaging_spec', { product_hint: 'Pinot' }, {})).toBeNull();
    expect(supplierKeyForResult('historical_lca_report', {}, {})).toBeNull();
  });
});
