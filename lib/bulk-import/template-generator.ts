import { INGREDIENT_COLUMNS, PACKAGING_CATEGORIES } from './types';

function generateHeaders(): string[] {
  const headers: string[] = [
    'Product Name*',
    'SKU',
    'Category',
    'Unit Size (Value)',
    'Unit Size (Unit)',
    'Description',
  ];

  for (let i = 1; i <= INGREDIENT_COLUMNS; i++) {
    headers.push(`Ingredient Name ${i}`);
    headers.push(`Ingredient Qty ${i}`);
    headers.push(`Ingredient Unit ${i}`);
  }

  for (const category of PACKAGING_CATEGORIES) {
    headers.push(`Packaging Category (${category})`);
    headers.push(`Packaging Material (${category})`);
    headers.push(`Packaging Weight (${category})`);
  }

  headers.push('Reusable (Yes/No)');

  return headers;
}

function generateExampleRow(): string[] {
  const row: string[] = [
    'Example Product',
    'GIN-001',
    'Gin',
    '750',
    'ml',
    'Classic London Dry gin with botanical infusions',
  ];

  const exampleIngredients = [
    { name: 'Juniper berries', qty: '45', unit: 'g' },
    { name: 'Coriander seeds', qty: '12', unit: 'g' },
    { name: 'Angelica root', qty: '8', unit: 'g' },
  ];

  for (let i = 0; i < INGREDIENT_COLUMNS; i++) {
    if (i < exampleIngredients.length) {
      row.push(exampleIngredients[i].name);
      row.push(exampleIngredients[i].qty);
      row.push(exampleIngredients[i].unit);
    } else {
      row.push('', '', '');
    }
  }

  const examplePackaging = [
    { category: 'Container', material: 'Glass', weight: '500' },
    { category: 'Label', material: 'Paper', weight: '50' },
    { category: 'Closure', material: 'Steel', weight: '25' },
    { category: 'Secondary', material: 'Cardboard', weight: '100' },
  ];

  for (const pkg of examplePackaging) {
    row.push(pkg.category);
    row.push(pkg.material);
    row.push(pkg.weight);
  }

  row.push('No');

  return row;
}

function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function arrayToCSVRow(arr: string[]): string {
  return arr.map(escapeCSVField).join(',');
}

export function generateTemplateCSV(): string {
  const headers = generateHeaders();
  const exampleRow = generateExampleRow();

  const lines = [
    arrayToCSVRow(headers),
    arrayToCSVRow(exampleRow),
  ];

  return lines.join('\n');
}

export function downloadTemplateAsCSV(filename = 'alkatera_product_import_template.csv'): void {
  const csvContent = generateTemplateCSV();
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export function createGoogleSheetsTemplate() {
  const headers = generateHeaders();
  const exampleRow = generateExampleRow();

  return {
    headers,
    exampleData: [exampleRow],
  };
}
