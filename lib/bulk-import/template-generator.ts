export function downloadTemplateAsCSV(): void {
  const headers = [
    'product_name',
    'product_sku',
    'product_category',
    'ingredient_name',
    'ingredient_quantity',
    'ingredient_unit',
    'packaging_type',
    'packaging_weight_g',
    'packaging_material',
  ];

  const exampleData = [
    'Example Product,SKU-001,Beverages,Water,100,ml,Bottle,25,Glass',
    'Example Product,SKU-001,Beverages,Sugar,50,g,Cap,2,Aluminium',
  ];

  const csvContent = [headers.join(','), ...exampleData].join('\n');

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

export function createGoogleSheetsTemplate(): string {
  return 'https://docs.google.com/spreadsheets/d/create';
}

export function generateTemplateHeaders(): string[] {
  return [
    'product_name',
    'product_sku',
    'product_category',
    'ingredient_name',
    'ingredient_quantity',
    'ingredient_unit',
    'packaging_type',
    'packaging_weight_g',
    'packaging_material',
  ];
}
