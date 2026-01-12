import { ParsedRow } from './types';

export function parseCSV(csvText: string): ParsedRow[] {
  const lines = csvText.split('\n').filter(line => line.trim());

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row: ParsedRow = {};

    headers.forEach((header, index) => {
      const value = values[index]?.trim();
      if (value) {
        const numValue = parseFloat(value);
        row[header] = isNaN(numValue) ? value : numValue;
      } else {
        row[header] = null;
      }
    });

    rows.push(row);
  }

  return rows;
}

export function validateRow(row: ParsedRow, requiredFields: string[]): string[] {
  const errors: string[] = [];

  requiredFields.forEach(field => {
    if (!row[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  });

  return errors;
}
