export function downloadTemplateAsCSV() {
  const csv = 'Material Name,Quantity,Unit\n';
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'bulk-import-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export function createGoogleSheetsTemplate() {
  const sheetUrl = 'https://docs.google.com/spreadsheets/d/1example/edit';
  window.open(sheetUrl, '_blank');
}
