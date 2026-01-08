export function downloadTemplateAsCSV() {
  const csvContent = `raw_name,quantity,unit,item_type
Sugar,1000,kg,ingredient
Water,500,L,ingredient
Glass Bottle,1000,units,packaging`;

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'bom-import-template.csv';
  link.click();
  window.URL.revokeObjectURL(url);
}

export function createGoogleSheetsTemplate() {
  const templateUrl = 'https://docs.google.com/spreadsheets/d/1example/edit';
  window.open(templateUrl, '_blank');
}
