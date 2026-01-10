export function downloadTemplateAsCSV(): void {
  const headers = ['Material Name', 'Quantity', 'Unit', 'Origin Country', 'Supplier'];
  const csvContent = headers.join(',') + '\n';
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'product-materials-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export function createGoogleSheetsTemplate(): string {
  return 'https://docs.google.com/spreadsheets/d/1example/edit';
}
