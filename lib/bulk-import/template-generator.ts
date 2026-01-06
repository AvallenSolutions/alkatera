/**
 * Template generator utilities for bulk import
 */

export function downloadTemplateAsCSV() {
  const headers = [
    'Product Name',
    'SKU',
    'Category',
    'Ingredient Name',
    'Quantity',
    'Unit',
    'Packaging Type',
    'Material',
  ];

  const exampleData = [
    'Example Product,PROD-001,Food,Flour,500,g,Bag,Plastic Film',
    'Example Product,PROD-001,Food,Sugar,200,g,Bag,Plastic Film',
  ];

  const csvContent = [headers.join(','), ...exampleData].join('\n');

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
  // Placeholder for Google Sheets integration
  // This would create a template in Google Sheets
  console.log('Google Sheets template creation not yet implemented');
}
