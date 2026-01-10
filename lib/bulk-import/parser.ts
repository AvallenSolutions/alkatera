import type { BulkImportRow } from './types';

export function parseCSV(csvContent: string): Record<string, string>[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));

  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  });
}

export function validateImportRow(row: Record<string, string>, rowIndex: number): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!row.name || row.name.trim() === '') {
    errors.push(`Row ${rowIndex}: Name is required`);
  }

  if (row.quantity && isNaN(Number(row.quantity))) {
    errors.push(`Row ${rowIndex}: Quantity must be a number`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function mapRowToBulkImport(row: Record<string, string>): BulkImportRow {
  return {
    name: row.name || '',
    quantity: row.quantity ? Number(row.quantity) : null,
    unit: row.unit || null,
    origin_country: row.origin_country || row.country,
    supplier: row.supplier,
    material_type: row.material_type,
    recyclable: row.recyclable?.toLowerCase() === 'yes' || row.recyclable?.toLowerCase() === 'true',
  };
}
