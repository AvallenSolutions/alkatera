export function downloadTemplateAsCSV() {
  const csv = `Item Type,Item Name,Quantity,Unit
ingredient,Sugar,100,kg
ingredient,Water,500,L
packaging,Glass Bottle,1000,units`;

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bulk-import-template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export function createGoogleSheetsTemplate() {
  const templateUrl = 'https://docs.google.com/spreadsheets/d/1example';
  window.open(templateUrl, '_blank');
}
