/**
 * Template Generator for Bulk Import
 *
 * Generates CSV templates for bulk importing product data
 */

export function downloadTemplateAsCSV() {
  const headers = [
    'Product Name',
    'SKU',
    'Category',
    'Ingredient Name',
    'Ingredient Quantity',
    'Ingredient Unit',
    'Packaging Type',
    'Packaging Material',
    'Packaging Quantity',
    'Packaging Unit'
  ];

  const exampleRows = [
    [
      'Example Product',
      'PROD-001',
      'Beverage',
      'Water',
      '100',
      'L',
      'Bottle',
      'Glass',
      '1',
      'unit'
    ],
    [
      '',
      '',
      '',
      'Sugar',
      '5',
      'kg',
      'Label',
      'Paper',
      '1',
      'unit'
    ]
  ];

  const csvContent = [
    headers.join(','),
    ...exampleRows.map(row => row.join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', 'product_import_template.csv');
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function createGoogleSheetsTemplate() {
  // Placeholder for Google Sheets template creation
  console.log('Google Sheets template creation not implemented yet');
}
