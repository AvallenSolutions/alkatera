import { ParsedBulkImport } from './types';

export function parseCSV(csvText: string): ParsedBulkImport {
  const rows: any[] = [];
  const errors: string[] = [];

  try {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      errors.push('CSV file must contain header row and at least one data row');
      return { rows, errors };
    }

    const headers = lines[0].split(',').map((h: string) => h.trim());

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v: string) => v.trim());

      if (values.length !== headers.length) {
        errors.push(`Row ${i + 1}: Column count mismatch`);
        continue;
      }

      const row: any = {};
      headers.forEach((header: string, index: number) => {
        row[header] = values[index];
      });

      rows.push(row);
    }
  } catch (error) {
    errors.push(`CSV parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { rows, errors };
}
