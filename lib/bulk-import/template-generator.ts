export function downloadTemplateAsCSV() {
  const csv = 'Item Type,Name,Quantity,Unit\ningredient,Example Material,100,kg\npackaging,Example Packaging,50,units';
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'bulk-import-template.csv';
  link.click();
  window.URL.revokeObjectURL(url);
}

export function createGoogleSheetsTemplate() {
  console.log('Google Sheets template creation not implemented');
}
