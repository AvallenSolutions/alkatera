/**
 * Template generator for bulk import functionality
 * Creates CSV templates for product and ingredient data import
 */

/**
 * Downloads a CSV template file for bulk product import
 */
export function downloadTemplateAsCSV(): void {
  const headers = [
    'Product Name',
    'Product Type',
    'Product Description',
    'Ingredient Name',
    'Ingredient Quantity',
    'Ingredient Unit',
    'Packaging Type',
    'Packaging Quantity',
    'Packaging Unit',
    'Notes'
  ];

  // Create CSV content
  const csvContent = [
    headers.join(','),
    // Add example row
    '"Example Product","Food","Sample product description","Flour","500","g","Box","1","unit","Optional notes"',
    // Add empty rows for user to fill
    ...Array(10).fill('').map(() => ',,,,,,,,,' )
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', 'product_import_template.csv');
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Creates and opens a Google Sheets template for bulk import
 * Note: This creates a downloadable template that can be uploaded to Google Sheets
 */
export function createGoogleSheetsTemplate(): void {
  // For now, this uses the same CSV download approach
  // In the future, this could integrate with Google Sheets API
  downloadTemplateAsCSV();
}
