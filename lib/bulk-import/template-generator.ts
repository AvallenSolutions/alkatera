/**
 * Template generator for bulk material import
 */

export function downloadTemplateAsCSV(): void {
  const csvContent = [
    ['Item Name', 'Quantity', 'Unit', 'Type (ingredient/packaging)'].join(','),
    ['Example Material', '100', 'kg', 'ingredient'].join(','),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', 'material_import_template.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function createGoogleSheetsTemplate(): string {
  return 'https://docs.google.com/spreadsheets/d/1example/edit';
}
