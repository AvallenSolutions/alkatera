import type {
  ProductRowData,
  IngredientData,
  PackagingData,
  ExtractedItem,
  ParsedImportData,
  ParseError,
} from './types';
import { INGREDIENT_COLUMNS, PACKAGING_CATEGORIES } from './types';

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function parseCSV(content: string): string[][] {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  return lines.map(parseCSVLine);
}

function getColumnIndex(headers: string[], columnName: string): number {
  const normalized = columnName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return headers.findIndex(h => {
    const headerNormalized = h.toLowerCase().replace(/[^a-z0-9]/g, '');
    return headerNormalized === normalized || headerNormalized.includes(normalized);
  });
}

function parseNumber(value: string): number | null {
  if (!value || value.trim() === '') return null;
  const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? null : num;
}

function generateId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function parseProductsCSV(content: string): ParsedImportData {
  const rows = parseCSV(content);
  const errors: ParseError[] = [];
  const products: ProductRowData[] = [];
  const items: ExtractedItem[] = [];

  if (rows.length < 2) {
    errors.push({
      row: 0,
      column: 'file',
      message: 'File must contain a header row and at least one data row',
      severity: 'error',
    });
    return { products, items, errors };
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  const productNameIdx = getColumnIndex(headers, 'Product Name');
  const skuIdx = getColumnIndex(headers, 'SKU');
  const categoryIdx = getColumnIndex(headers, 'Category');
  const unitValueIdx = getColumnIndex(headers, 'Unit Size Value');
  const unitUnitIdx = getColumnIndex(headers, 'Unit Size Unit');
  const descriptionIdx = getColumnIndex(headers, 'Description');
  const reusableIdx = getColumnIndex(headers, 'Reusable');

  if (productNameIdx === -1) {
    errors.push({
      row: 0,
      column: 'Product Name',
      message: 'Required column "Product Name" not found',
      severity: 'error',
    });
    return { products, items, errors };
  }

  for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
    const row = dataRows[rowIndex];
    const rowNum = rowIndex + 2;

    const productName = row[productNameIdx]?.trim();

    if (!productName || productName.toLowerCase() === 'example') {
      continue;
    }

    const ingredients: IngredientData[] = [];
    for (let i = 1; i <= INGREDIENT_COLUMNS; i++) {
      const nameIdx = getColumnIndex(headers, `Ingredient Name ${i}`);
      const qtyIdx = getColumnIndex(headers, `Ingredient Qty ${i}`);
      const unitIdx = getColumnIndex(headers, `Ingredient Unit ${i}`);

      const name = nameIdx >= 0 ? row[nameIdx]?.trim() : '';
      const qty = qtyIdx >= 0 ? parseNumber(row[qtyIdx]) : null;
      const unit = unitIdx >= 0 ? row[unitIdx]?.trim() : null;

      if (name) {
        ingredients.push({ name, quantity: qty, unit, index: i });

        items.push({
          id: generateId(),
          raw_name: name,
          clean_name: name,
          quantity: qty,
          unit: unit || null,
          item_type: 'ingredient',
          matched_material_id: null,
          match_confidence: null,
          is_reviewed: false,
          is_imported: false,
          product_name: productName,
          product_index: rowIndex,
        });
      }
    }

    const packaging: PackagingData[] = [];
    for (const category of PACKAGING_CATEGORIES) {
      const catIdx = getColumnIndex(headers, `Packaging Category ${category}`);
      const matIdx = getColumnIndex(headers, `Packaging Material ${category}`);
      const weightIdx = getColumnIndex(headers, `Packaging Weight ${category}`);

      const material = matIdx >= 0 ? row[matIdx]?.trim() : '';
      const weight = weightIdx >= 0 ? parseNumber(row[weightIdx]) : null;

      if (material) {
        packaging.push({ category, material, weight });

        items.push({
          id: generateId(),
          raw_name: material,
          clean_name: material,
          quantity: weight,
          unit: 'g',
          item_type: 'packaging',
          packaging_category: category,
          matched_material_id: null,
          match_confidence: null,
          is_reviewed: false,
          is_imported: false,
          product_name: productName,
          product_index: rowIndex,
        });
      }
    }

    const reusableValue = reusableIdx >= 0 ? row[reusableIdx]?.toLowerCase().trim() : '';
    const reusable = reusableValue === 'yes' || reusableValue === 'true' || reusableValue === '1';

    const product: ProductRowData = {
      productName,
      sku: skuIdx >= 0 ? row[skuIdx]?.trim() : undefined,
      category: categoryIdx >= 0 ? row[categoryIdx]?.trim() : undefined,
      unitSizeValue: unitValueIdx >= 0 ? parseNumber(row[unitValueIdx]) ?? undefined : undefined,
      unitSizeUnit: unitUnitIdx >= 0 ? row[unitUnitIdx]?.trim() : undefined,
      description: descriptionIdx >= 0 ? row[descriptionIdx]?.trim() : undefined,
      ingredients,
      packaging,
      reusable,
    };

    if (ingredients.length === 0 && packaging.length === 0) {
      errors.push({
        row: rowNum,
        column: 'Ingredients/Packaging',
        message: `Product "${productName}" has no ingredients or packaging data`,
        severity: 'warning',
      });
    }

    products.push(product);
  }

  if (products.length === 0) {
    errors.push({
      row: 0,
      column: 'file',
      message: 'No valid products found in the file',
      severity: 'error',
    });
  }

  return { products, items, errors };
}

export function validateImportData(data: ParsedImportData): ParseError[] {
  const errors: ParseError[] = [...data.errors];

  const productNames = new Set<string>();
  const skus = new Set<string>();

  data.products.forEach((product, index) => {
    const rowNum = index + 2;

    if (productNames.has(product.productName)) {
      errors.push({
        row: rowNum,
        column: 'Product Name',
        message: `Duplicate product name: "${product.productName}"`,
        severity: 'error',
      });
    }
    productNames.add(product.productName);

    if (product.sku) {
      if (skus.has(product.sku)) {
        errors.push({
          row: rowNum,
          column: 'SKU',
          message: `Duplicate SKU: "${product.sku}"`,
          severity: 'error',
        });
      }
      skus.add(product.sku);
    }

    if (product.unitSizeValue && product.unitSizeValue <= 0) {
      errors.push({
        row: rowNum,
        column: 'Unit Size',
        message: 'Unit size must be a positive number',
        severity: 'error',
      });
    }
  });

  return errors;
}

export function summarizeImportData(data: ParsedImportData): {
  productCount: number;
  ingredientCount: number;
  packagingCount: number;
  errorCount: number;
  warningCount: number;
} {
  const ingredientCount = data.items.filter(i => i.item_type === 'ingredient').length;
  const packagingCount = data.items.filter(i => i.item_type === 'packaging').length;
  const errorCount = data.errors.filter(e => e.severity === 'error').length;
  const warningCount = data.errors.filter(e => e.severity === 'warning').length;

  return {
    productCount: data.products.length,
    ingredientCount,
    packagingCount,
    errorCount,
    warningCount,
  };
}
