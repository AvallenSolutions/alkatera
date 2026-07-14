import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { workbookToText, csvToText, sanitiseFileName } from '../spreadsheet-text';

function makeWorkbook(sheets: Record<string, unknown[][]>): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return wb;
}

describe('sanitiseFileName', () => {
  it('strips angle brackets and control characters', () => {
    expect(sanitiseFileName('BEV<25>\nrecipe.xlsx')).toBe('BEV 25 recipe.xlsx');
  });

  it('falls back for empty names', () => {
    expect(sanitiseFileName('<>')).toBe('untitled');
  });
});

describe('workbookToText', () => {
  it('serialises sheets as labelled CSV fences with dimensions', () => {
    const wb = makeWorkbook({
      Sheet1: [
        ['Ingredient', 'g/Litre'],
        ['White Grape Juice Concentrate', 47.856],
        ['Glycerine', 30],
      ],
    });
    const text = workbookToText(wb, 'recipe.xlsx');
    expect(text).toContain('Spreadsheet file: recipe.xlsx');
    expect(text).toContain('Sheets: 1 (Sheet1)');
    expect(text).toContain('=== Sheet "Sheet1" (3 rows x 2 cols) ===');
    expect(text).toContain('Ingredient,g/Litre');
    expect(text).toContain('White Grape Juice Concentrate,47.856');
  });

  it('quotes cells containing commas', () => {
    const wb = makeWorkbook({ S: [['Salt, celtic', 1]] });
    expect(workbookToText(wb, 'f.xlsx')).toContain('"Salt, celtic",1');
  });

  it('strips angle brackets from cell text', () => {
    const wb = makeWorkbook({ S: [['<script>alert(1)</script>', 'ok']] });
    const text = workbookToText(wb, 'f.xlsx');
    expect(text).not.toContain('<script>');
    expect(text).toContain('script alert(1) /script,ok');
  });

  it('caps rows per sheet and notes the truncation', () => {
    const rows = Array.from({ length: 150 }, (_, i) => [`row ${i}`, i]);
    const wb = makeWorkbook({ Data: rows });
    const text = workbookToText(wb, 'big.xlsx', { maxRowsPerSheet: 100 });
    expect(text).toContain('showing first 100 rows');
    expect(text).toContain('[… truncated: 50 more rows]');
    expect(text).not.toContain('row 120');
  });

  it('sheds later sheets first when over the total budget', () => {
    const bigRows = Array.from({ length: 90 }, (_, i) => [`item ${i}`, `value ${i}`, i]);
    const wb = makeWorkbook({ First: bigRows, Second: bigRows, Third: bigRows });
    const text = workbookToText(wb, 'multi.xlsx', { maxTotalChars: 3000 });
    expect(text).toContain('=== Sheet "First"');
    expect(text).toContain('=== Sheet "Third"');
    expect(text).toContain('[… sheet content omitted to fit the size budget]');
    // First sheet keeps its body; Third is shed to a header line.
    expect(text).toContain('item 50');
    expect(text.length).toBeLessThanOrEqual(3100);
  });

  it('hard-cuts when even the shed header line overflows the budget', () => {
    // One row of 200 wide columns: the header line alone exceeds the budget,
    // so shedding cannot save it and the hard cut applies.
    const wideRow = Array.from({ length: 200 }, () => 'x'.repeat(180));
    const wb = makeWorkbook({ Huge: [wideRow] });
    const text = workbookToText(wb, 'huge.xlsx', { maxTotalChars: 2000 });
    expect(text.length).toBeLessThanOrEqual(2100);
    expect(text).toContain('[… truncated to fit the size budget]');
  });

  it('handles empty workbooks and empty sheets', () => {
    const wb = makeWorkbook({ Empty: [] });
    const text = workbookToText(wb, 'empty.xlsx');
    expect(text).toContain('[empty sheet]');
  });

  it('lists but does not render sheets beyond maxSheets', () => {
    const sheets: Record<string, unknown[][]> = {};
    for (let i = 1; i <= 10; i++) sheets[`S${i}`] = [['a', i]];
    const wb = makeWorkbook(sheets);
    const text = workbookToText(wb, 'many.xlsx', { maxSheets: 3 });
    expect(text).toContain('Sheets: 10');
    expect(text).toContain('[only the first 3 sheets are shown]');
    expect(text).not.toContain('=== Sheet "S4"');
  });
});

describe('csvToText', () => {
  it('serialises rows with a header and count', () => {
    const csv = 'Date,Amount\n2026-01-01,42.50\n2026-01-02,13.20\n';
    const text = csvToText(new TextEncoder().encode(csv), 'ledger.csv');
    expect(text).toContain('CSV file: ledger.csv');
    expect(text).toContain('Rows: 3');
    expect(text).toContain('2026-01-01,42.50');
  });

  it('caps rows and notes the truncation', () => {
    const csv = ['h1,h2', ...Array.from({ length: 200 }, (_, i) => `r${i},${i}`)].join('\n');
    const text = csvToText(new TextEncoder().encode(csv), 'big.csv', { maxRowsPerSheet: 50 });
    expect(text).toContain('(showing first 50)');
    expect(text).toContain('[… truncated: 151 more rows]');
    expect(text).not.toContain('r180,');
  });

  it('strips angle brackets', () => {
    const csv = 'a,<b>\n1,2';
    const text = csvToText(new TextEncoder().encode(csv), 'f.csv');
    expect(text).not.toContain('<b>');
  });
});
