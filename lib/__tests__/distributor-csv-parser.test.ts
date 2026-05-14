import { describe, it, expect } from 'vitest';
import { parseCSV } from '@/lib/distributor/parsers/csv-parser';

describe('parseCSV (distributor)', () => {
  it('parses a comma-delimited CSV with quoted fields', () => {
    const csv = `Brand,Product Name,SKU
"Château Margaux","Margaux 2018",MAR-2018
Hennessy,"X.O.","HEN-XO"`;
    const result = parseCSV(csv);
    expect(result.error).toBeUndefined();
    expect(result.headers).toEqual(['Brand', 'Product Name', 'SKU']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({
      Brand: 'Château Margaux',
      'Product Name': 'Margaux 2018',
      SKU: 'MAR-2018',
    });
    expect(result.rows[1].SKU).toBe('HEN-XO');
  });

  it('auto-detects tab delimiter when present', () => {
    const tsv = `Brand\tProduct\tSKU\nHennessy\tX.O.\tHEN-XO`;
    const result = parseCSV(tsv);
    expect(result.error).toBeUndefined();
    expect(result.headers).toEqual(['Brand', 'Product', 'SKU']);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].Brand).toBe('Hennessy');
  });

  it('returns an error when there is no data row', () => {
    const result = parseCSV('Brand,Product,SKU');
    expect(result.error).toMatch(/header row and at least one data row/i);
  });

  it('returns an error for an empty file', () => {
    expect(parseCSV('').error).toBe('File is empty');
  });

  it('skips empty rows', () => {
    const csv = `Brand,Product\nHennessy,X.O.\n\n\nMartell,Cordon Bleu`;
    const result = parseCSV(csv);
    expect(result.rows).toHaveLength(2);
  });

  it('handles double-quoted escapes', () => {
    const csv = `Brand,Note\n"Foo","She said ""hi"" to me"`;
    const result = parseCSV(csv);
    expect(result.rows[0].Note).toBe('She said "hi" to me');
  });

  it('strips UTF-8 BOM from the start of the file', () => {
    const csv = `﻿Brand,Product\nHennessy,X.O.`;
    const result = parseCSV(csv);
    expect(result.headers).toEqual(['Brand', 'Product']);
  });
});
