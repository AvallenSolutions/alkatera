export function downloadTemplateAsCSV(): void {
  const csvContent = [
    'item_name,quantity,unit,type',
    'Example Ingredient,1000,g,ingredient',
    'Example Packaging,50,units,packaging',
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'product_import_template.csv';
  link.click();
}

export async function createGoogleSheetsTemplate(): Promise<string> {
  return 'https://docs.google.com/spreadsheets/d/template';
}
