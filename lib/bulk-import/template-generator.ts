export function downloadTemplateAsCSV(): void {
  const headers = [
    'Product Name',
    'SKU',
    'Category',
    'Description',
    'Ingredient Name',
    'Quantity',
    'Unit',
    'Origin',
    'Packaging Type',
    'Packaging Material',
    'Packaging Weight',
  ];

  const exampleRows = [
    [
      'Example Product',
      'SKU001',
      'Beverage',
      'An example product',
      'Water',
      '500',
      'ml',
      'UK',
      'Bottle',
      'Glass',
      '250g',
    ],
    [
      '',
      '',
      '',
      '',
      'Sugar',
      '50',
      'g',
      'Brazil',
      '',
      '',
      '',
    ],
  ];

  const csvContent = [
    headers.join(','),
    ...exampleRows.map(row => row.join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', 'product-import-template.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function createGoogleSheetsTemplate(): string {
  return 'https://docs.google.com/spreadsheets/d/example-template-id/edit';
}
