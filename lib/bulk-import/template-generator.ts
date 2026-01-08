import {
  INGREDIENT_COLUMNS,
  PACKAGING_CATEGORIES,
  SUPPORTED_CATEGORIES,
  SUPPORTED_UNITS,
} from './types';

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
    'Example',
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

export function createGoogleSheetsTemplate(): {
  headers: string[];
  exampleData: string[][];
  validationRules: ValidationRule[];
} {
  const headers = generateHeaders();
  const exampleRow = generateExampleRow();

  const validationRules: ValidationRule[] = [
    {
      column: 'Category',
      type: 'list',
      values: [...SUPPORTED_CATEGORIES],
    },
    {
      column: 'Unit Size (Unit)',
      type: 'list',
      values: [...SUPPORTED_UNITS],
    },
    {
      column: 'Reusable (Yes/No)',
      type: 'list',
      values: ['Yes', 'No'],
    },
  ];

  for (let i = 1; i <= INGREDIENT_COLUMNS; i++) {
    validationRules.push({
      column: `Ingredient Unit ${i}`,
      type: 'list',
      values: [...SUPPORTED_UNITS],
    });
  }

  for (const category of PACKAGING_CATEGORIES) {
    validationRules.push({
      column: `Packaging Category (${category})`,
      type: 'list',
      values: [category],
    });
  }

  return {
    headers,
    exampleData: [exampleRow],
    validationRules,
  };
}

interface ValidationRule {
  column: string;
  type: 'list' | 'number' | 'text';
  values?: string[];
  min?: number;
  max?: number;
}

export function getTemplateInstructions(): string {
  return `
ALKATERA PRODUCT IMPORT TEMPLATE - INSTRUCTIONS

REQUIRED FIELDS:
- Product Name: The name of your product (required)

OPTIONAL FIELDS:
- SKU: Your internal product code
- Category: Product category (${SUPPORTED_CATEGORIES.join(', ')})
- Unit Size: The size of one consumer unit (e.g., 750 ml)
- Description: Product description

INGREDIENTS:
- You can add up to ${INGREDIENT_COLUMNS} ingredients per product
- For each ingredient, provide: Name, Quantity, Unit
- Supported units: ${SUPPORTED_UNITS.join(', ')}
- Leave blank for unused ingredient slots

PACKAGING:
- Four packaging categories are supported: ${PACKAGING_CATEGORIES.join(', ')}
- For each, provide: Material type and Weight (in grams)
- Leave blank for unused packaging types

REUSABLE:
- Enter "Yes" if the packaging is designed for reuse, "No" otherwise

TIPS:
- Use the example row as a guide
- Delete the example row before uploading
- Save as CSV or Excel format
- Ensure all quantities are numeric values
`.trim();
}
