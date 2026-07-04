import { describe, expect, it } from 'vitest';
import { applyFieldAliases, computeFieldDiff, FIELD_ALIASES } from '../feedback-diff';

describe('computeFieldDiff', () => {
  it('returns an empty diff for identical payloads', () => {
    const payload = { supplier_name: 'Biffa', entries: [{ description: 'General waste', quantity: 2, unit: 'tonnes' }] };
    const diff = computeFieldDiff(payload, JSON.parse(JSON.stringify(payload)));
    expect(diff.fields).toEqual([]);
    expect(diff.edited + diff.added + diff.removed).toBe(0);
  });

  it('reports a scalar edit with from/to values', () => {
    const diff = computeFieldDiff({ period_start: '2026-01-01' }, { period_start: '2026-01-15' });
    expect(diff.edited).toBe(1);
    expect(diff.fields[0]).toMatchObject({
      path: 'period_start',
      from: '2026-01-01',
      to: '2026-01-15',
      change: 'edited',
    });
  });

  it('treats numeric strings and numbers as equivalent', () => {
    const diff = computeFieldDiff(
      { weight_g: 450, quantity_kg: 12.5 },
      { weight_g: '450', quantity_kg: '12.50' },
    );
    expect(diff.fields).toEqual([]);
  });

  it('treats null, undefined and empty string as one empty value', () => {
    const diff = computeFieldDiff({ invoice_date: null, currency: undefined }, { invoice_date: '', notes: '' });
    expect(diff.fields).toEqual([]);
  });

  it('classifies empty→value as added and value→empty as removed', () => {
    const diff = computeFieldDiff({ origin: 'Leith', destination: null }, { origin: '', destination: 'Bristol' });
    const byPath = Object.fromEntries(diff.fields.map((f) => [f.path, f.change]));
    expect(byPath.origin).toBe('removed');
    expect(byPath.destination).toBe('added');
  });

  it('aligns arrays of objects by identity key so reordering is not an edit', () => {
    const classifier = {
      line_items: [
        { description: 'Caps', amount: 1200 },
        { description: 'Shipping', amount: 150 },
      ],
    };
    const saved = {
      line_items: [
        { description: 'Shipping', amount: 150 },
        { description: 'Caps', amount: 1200 },
      ],
    };
    expect(computeFieldDiff(classifier, saved).fields).toEqual([]);
  });

  it('reports removed and added line items via identity keys', () => {
    const classifier = { line_items: [{ description: 'Caps', amount: 1200 }, { description: 'VAT', amount: 240 }] };
    const saved = { line_items: [{ description: 'Caps', amount: 1300 }, { description: 'Labels', amount: 90 }] };
    const diff = computeFieldDiff(classifier, saved);
    const changes = Object.fromEntries(diff.fields.map((f) => [f.path, f.change]));
    expect(changes['line_items[caps].amount']).toBe('edited');
    expect(changes['line_items[vat]']).toBe('removed');
    expect(changes['line_items[labels]']).toBe('added');
  });

  it('diffs samples arrays by location_label', () => {
    const classifier = { samples: [{ location_label: 'Field A', depth_cm: 30, soc_concentration_pct: 2.5 }] };
    const saved = { samples: [{ location_label: 'Field A', depth_cm: 10, soc_concentration_pct: 2.5 }] };
    const diff = computeFieldDiff(classifier, saved);
    expect(diff.fields).toHaveLength(1);
    expect(diff.fields[0]).toMatchObject({ path: 'samples[field a].depth_cm', change: 'edited' });
  });

  it('falls back to index comparison for arrays without identity keys', () => {
    const diff = computeFieldDiff({ values: [1, 2] }, { values: [1, 3, 4] });
    const paths = diff.fields.map((f) => f.path);
    expect(paths).toContain('values[1]');
    expect(paths).toContain('values[2]');
  });

  it('ignores plumbing and save-flow binding keys', () => {
    const diff = computeFieldDiff(
      { type: 'supplier_invoice', stashId: 'a/b/c.pdf' },
      { type: 'x', stashId: 'other', facility_id: 'uuid', notes: 'hello', billName: 'My bill' },
    );
    expect(diff.fields).toEqual([]);
  });

  it('caps the number of reported fields at 200', () => {
    const classifier: Record<string, unknown> = {};
    const saved: Record<string, unknown> = {};
    for (let i = 0; i < 300; i++) {
      classifier[`f${i}`] = 'a';
      saved[`f${i}`] = 'b';
    }
    const diff = computeFieldDiff(classifier, saved);
    expect(diff.fields).toHaveLength(200);
  });

  it('truncates long values to 500 characters', () => {
    const diff = computeFieldDiff({ description: 'x'.repeat(2000) }, { description: 'y' });
    expect(String(diff.fields[0].from)).toHaveLength(500);
  });
});

describe('applyFieldAliases', () => {
  it('renames saved-side keys to classifier-side names for supplier invoices', () => {
    const saved = applyFieldAliases('supplier_invoice', { category: 'capital_goods', currency: 'GBP' });
    expect(saved).toEqual({ suggested_category: 'capital_goods', currency: 'GBP' });
  });

  it('maps certification form fields onto classifier fields', () => {
    expect(FIELD_ALIASES.certification.certification_number).toBe('certificate_number');
    const saved = applyFieldAliases('certification', { certification_number: 'BC-123', certification_date: '2026-01-01' });
    expect(saved).toEqual({ certificate_number: 'BC-123', issue_date: '2026-01-01' });
  });

  it('passes unknown types through untouched', () => {
    const payload = { anything: 1 };
    expect(applyFieldAliases('utility_bill', payload)).toEqual(payload);
  });
});
