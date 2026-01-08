export function downloadTemplateAsCSV(): void {
  const headers = ['name', 'quantity', 'unit', 'type'];
  const sampleRow = ['Example Ingredient', '100', 'kg', 'ingredient'];
  const csvContent = [headers.join(','), sampleRow.join(',')].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'product_import_template.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function createGoogleSheetsTemplate(): string {
  return 'https://docs.google.com/spreadsheets/d/1example/copy';
}
