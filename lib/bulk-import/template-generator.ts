export function downloadTemplateAsCSV() {
  const headers = [
    'product_name',
    'sku',
    'description',
    'category',
    'ingredient_name',
    'ingredient_quantity',
    'ingredient_unit',
    'packaging_type',
    'packaging_material',
    'packaging_weight_g'
  ];

  const exampleRows = [
    ['Example Product', 'SKU-001', 'A sample product', 'Beverage', 'Water', '500', 'ml', 'Bottle', 'PET', '25'],
    ['', '', '', '', 'Sugar', '50', 'g', '', '', ''],
    ['Another Product', 'SKU-002', 'Another sample', 'Food', 'Flour', '200', 'g', 'Bag', 'Paper', '10'],
  ];

  const csvContent = [
    headers.join(','),
    ...exampleRows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', 'alkatera-product-import-template.csv');
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export function createGoogleSheetsTemplate(): string {
  return 'https://docs.google.com/spreadsheets/d/create';
}
