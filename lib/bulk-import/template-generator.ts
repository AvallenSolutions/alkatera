export function downloadTemplateAsCSV() {
  const csvContent = 'Material Name,Quantity,Unit,Type\n';
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'product-import-template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export function createGoogleSheetsTemplate() {
  console.log('Google Sheets template creation not yet implemented');
}
