import * as XLSX from 'xlsx';
import type { ParsedTable } from './csv-parser';

/**
 * Parse the first worksheet of an XLSX buffer into a { headers, rows } shape.
 * Multi-sheet workbooks are reduced to the first sheet only (consistent with
 * what a distributor sees when they "open the workbook").
 */
export function parseExcel(buffer: Buffer): ParsedTable {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { headers: [], rows: [], error: `Could not read Excel file: ${message}` };
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { headers: [], rows: [], error: 'Workbook contains no sheets' };
  }
  const sheet = workbook.Sheets[firstSheetName];

  // header: 1 returns an array-of-arrays so we can capture the literal
  // header row even if cells contain duplicate / blank names.
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: '',
  });

  if (aoa.length === 0) {
    return { headers: [], rows: [], error: 'Sheet is empty' };
  }
  if (aoa.length < 2) {
    return { headers: [], rows: [], error: 'Sheet must contain a header row and at least one data row' };
  }

  const headers = (aoa[0] as unknown[]).map((h) => String(h ?? '').trim());
  if (headers.every((h) => h.length === 0)) {
    return { headers: [], rows: [], error: 'Header row is empty' };
  }

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < aoa.length; i++) {
    const values = aoa[i] as unknown[];
    const row: Record<string, string> = {};
    let hasValue = false;
    headers.forEach((header, idx) => {
      const value = String(values?.[idx] ?? '').trim();
      row[header] = value;
      if (value.length > 0) hasValue = true;
    });
    if (hasValue) rows.push(row);
  }

  return { headers, rows };
}
