import { ImportedItem } from './types';

export function parseCSV(csvContent: string): ImportedItem[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

  return lines.slice(1).map((line, index) => {
    const values = line.split(',').map(v => v.trim());
    const item: any = { id: `import-${index}` };

    headers.forEach((header, i) => {
      item[header] = values[i];
    });

    return item as ImportedItem;
  });
}
