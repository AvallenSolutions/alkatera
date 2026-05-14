import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseExcel } from '@/lib/distributor/parsers/excel-parser';

function buildBuffer(sheets: Record<string, Array<Array<string | number>>>): Buffer {
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('parseExcel', () => {
  it('parses the first sheet of a single-sheet workbook', () => {
    const buf = buildBuffer({
      Sheet1: [
        ['Brand', 'Product Name', 'SKU'],
        ['Hennessy', 'X.O.', 'HEN-XO'],
        ['Martell', 'Cordon Bleu', 'MAR-CB'],
      ],
    });
    const result = parseExcel(buf);
    expect(result.error).toBeUndefined();
    expect(result.headers).toEqual(['Brand', 'Product Name', 'SKU']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({
      Brand: 'Hennessy',
      'Product Name': 'X.O.',
      SKU: 'HEN-XO',
    });
  });

  it('only reads the first sheet of a multi-sheet workbook', () => {
    const buf = buildBuffer({
      Portfolio: [
        ['Brand', 'Product'],
        ['Hennessy', 'X.O.'],
      ],
      Notes: [
        ['Note'],
        ['Should be ignored'],
      ],
    });
    const result = parseExcel(buf);
    expect(result.headers).toEqual(['Brand', 'Product']);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].Brand).toBe('Hennessy');
  });

  it('skips fully blank rows', () => {
    const buf = buildBuffer({
      Sheet1: [
        ['Brand', 'Product'],
        ['Hennessy', 'X.O.'],
        ['', ''],
        ['Martell', 'Cordon Bleu'],
      ],
    });
    const result = parseExcel(buf);
    expect(result.rows).toHaveLength(2);
  });

  it('errors when the sheet has no data rows', () => {
    const buf = buildBuffer({ Sheet1: [['Brand', 'Product']] });
    const result = parseExcel(buf);
    expect(result.error).toMatch(/header row and at least one data row/i);
  });
});
