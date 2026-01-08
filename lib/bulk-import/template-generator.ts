export function downloadTemplateAsCSV(): void {
  const template = `name,quantity,unit,item_type
"Example Ingredient 1",100,kg,ingredient
"Example Ingredient 2",50,L,ingredient
"Glass Bottle",0.5,kg,packaging
"Label",0.01,kg,packaging`;

  const blob = new Blob([template], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'product-import-template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function createGoogleSheetsTemplate(): string {
  return 'https://docs.google.com/spreadsheets/d/template';
}
