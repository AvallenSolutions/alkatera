import { BulkImportItem } from './types';

export function parseCSV(csvContent: string): BulkImportItem[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

  const items: BulkImportItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());

    items.push({
      raw_name: values[0] || '',
      clean_name: values[0] || null,
      quantity: values[1] ? parseFloat(values[1]) : null,
      unit: values[2] || null,
      item_type: 'ingredient',
      matched_material_id: null,
      match_confidence: null,
      is_reviewed: false,
    });
  }

  return items;
}

export function validateImportData(items: BulkImportItem[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  items.forEach((item, index) => {
    if (!item.raw_name) {
      errors.push(`Row ${index + 1}: Name is required`);
    }
    if (item.quantity && item.quantity <= 0) {
      errors.push(`Row ${index + 1}: Quantity must be positive`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
