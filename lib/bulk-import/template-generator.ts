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

export function createGoogleSheetsTemplate(_type: 'ingredients' | 'packaging' = 'ingredients'): string {
  const baseUrl = 'https://docs.google.com/spreadsheets/d/create';
  return baseUrl;
}
