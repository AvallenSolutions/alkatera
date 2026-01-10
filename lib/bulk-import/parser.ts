import type { BulkImportRow, BulkImportResult } from './types';

export async function parseCSV(file: File): Promise<BulkImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
          resolve({
            success: false,
            totalRows: 0,
            validRows: 0,
            errorRows: 0,
            rows: [],
          });
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim());
        const rows: BulkImportRow[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          const data: Record<string, string> = {};

          headers.forEach((header, idx) => {
            data[header] = values[idx] || '';
          });

          rows.push({
            rowNumber: i,
            data,
            errors: [],
            warnings: [],
          });
        }

        resolve({
          success: true,
          totalRows: rows.length,
          validRows: rows.filter(r => r.errors.length === 0).length,
          errorRows: rows.filter(r => r.errors.length > 0).length,
          rows,
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function validateRow(
  row: BulkImportRow,
  requiredColumns: string[]
): BulkImportRow {
  const errors: string[] = [];

  requiredColumns.forEach(col => {
    if (!row.data[col] || row.data[col].trim() === '') {
      errors.push(`Missing required field: ${col}`);
    }
  });

  return {
    ...row,
    errors: [...row.errors, ...errors],
  };
}
