export function downloadTemplateAsCSV() {
  const csvContent = `name,quantity,unit,type
Coffee Beans,1,kg,ingredient
Milk,500,ml,ingredient
Sugar,100,g,ingredient
Glass Bottle,1,unit,packaging`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', 'product-import-template.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function createGoogleSheetsTemplate() {
  const templateUrl = 'https://docs.google.com/spreadsheets/d/1XYZ/edit';
  window.open(templateUrl, '_blank');
}
