export function downloadTemplateAsCSV() {
  const csvContent = `Name,Quantity,Unit,Type
Example Ingredient,100,kg,ingredient
Example Packaging,50,units,packaging`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', 'product_import_template.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function createGoogleSheetsTemplate(): string {
  return 'https://docs.google.com/spreadsheets/d/1-example-template-id/copy';
}
