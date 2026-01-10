export function downloadTemplateAsCSV(type: 'ingredients' | 'packaging' = 'ingredients'): void {
  const headers = type === 'ingredients'
    ? ['Name', 'Quantity', 'Unit', 'Origin Country', 'Supplier']
    : ['Name', 'Material Type', 'Weight (g)', 'Recyclable', 'Supplier'];

  const sampleData = type === 'ingredients'
    ? [
        ['Organic Sugar', '100', 'kg', 'Brazil', 'Example Supplier'],
        ['Wheat Flour', '50', 'kg', 'UK', 'Example Supplier'],
      ]
    : [
        ['Glass Bottle 750ml', 'Glass', '350', 'Yes', 'Example Supplier'],
        ['Aluminium Cap', 'Aluminium', '5', 'Yes', 'Example Supplier'],
      ];

  const csvContent = [
    headers.join(','),
    ...sampleData.map(row => row.join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${type}_import_template.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function createGoogleSheetsTemplate(type: 'ingredients' | 'packaging' = 'ingredients'): string {
  const baseUrl = 'https://docs.google.com/spreadsheets/d/create';
  return baseUrl;
}

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
