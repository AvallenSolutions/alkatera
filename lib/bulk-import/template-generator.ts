export function downloadTemplateAsCSV() {
  const csv = 'Product Name,Quantity,Unit,Type\n';
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function createGoogleSheetsTemplate() {
  console.log('Google Sheets template creation not yet implemented');
}
