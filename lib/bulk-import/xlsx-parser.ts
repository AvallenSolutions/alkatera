import * as XLSX from 'xlsx';
import type {
  ParsedImportData,
  ParsedProduct,
  ParsedIngredient,
  ParsedPackaging,
  ParsedPackagingComponent,
} from './types';

/**
 * Parse a completed Alkatera product-import template (.xlsx).
 *
 * Expects three data sheets: Products, Ingredients, Packaging.
 * Header rows are detected by matching known required column names
 * (rows above the header are treated as description / decoration).
 */
export function parseImportXLSX(buffer: ArrayBuffer): ParsedImportData {
  const wb = XLSX.read(buffer, { type: 'array' });
  const errors: string[] = [];

  const products = parseProductsSheet(wb, errors);
  const ingredients = parseIngredientsSheet(wb, errors);
  const packaging = parsePackagingSheet(wb, errors);

  // Cross-validate: every ingredient/packaging SKU should match a product
  const skus = new Set(products.map(p => p.sku));
  for (const ing of ingredients) {
    if (!skus.has(ing.product_sku)) {
      errors.push(`Ingredient "${ing.name}" references unknown SKU "${ing.product_sku}"`);
    }
  }
  for (const pkg of packaging) {
    if (!skus.has(pkg.product_sku)) {
      errors.push(`Packaging "${pkg.name}" references unknown SKU "${pkg.product_sku}"`);
    }
  }

  return { products, ingredients, packaging, errors };
}

// ── Helpers ────────────────────────────────────────────────────────────────

type RawRow = (string | number | boolean | null | undefined)[];

function getSheetRows(wb: XLSX.WorkBook, name: string): RawRow[] | null {
  const ws = wb.Sheets[name];
  if (!ws) return null;
  return XLSX.utils.sheet_to_json<RawRow>(ws, { header: 1, defval: null });
}

/**
 * Find the header row index by looking for a row where the first cell
 * contains one of the expected markers (case-insensitive, trimmed).
 */
function findHeaderRow(rows: RawRow[], markers: string[]): number {
  const lower = markers.map(m => m.toLowerCase().replace(/\s*\*\s*/g, '').trim());
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const first = String(rows[i]?.[0] ?? '').toLowerCase().replace(/\s*\*\s*/g, '').trim();
    if (lower.includes(first)) return i;
  }
  return -1;
}

function str(val: unknown): string {
  if (val == null) return '';
  return String(val).trim();
}

function num(val: unknown): number | null {
  if (val == null || val === '') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function yesNo(val: unknown): boolean | null {
  const s = str(val).toLowerCase();
  if (s === 'yes' || s === 'true' || s === '1') return true;
  if (s === 'no' || s === 'false' || s === '0') return false;
  return null;
}

/** Return val only if it's in the allowed set, otherwise null */
function enumVal(val: unknown, allowed: string[]): string | null {
  const s = str(val).toLowerCase();
  return allowed.includes(s) ? s : null;
}

// DB CHECK constraint allowed values
const VALID_PACKAGING_CATEGORIES = ['container', 'label', 'closure', 'secondary', 'shipment', 'tertiary'];
const VALID_EPR_LEVELS = ['primary', 'secondary', 'tertiary', 'shipment'];
const VALID_EPR_ACTIVITIES = ['brand', 'packed_filled', 'imported', 'empty', 'hired', 'marketplace'];
const VALID_EPR_RAM_RATINGS = ['red', 'amber', 'green'];
const VALID_EPR_UK_NATIONS = ['england', 'scotland', 'wales', 'northern_ireland'];
const VALID_TRANSPORT_MODES = ['truck', 'train', 'ship', 'air'];

// ── Products sheet ─────────────────────────────────────────────────────────

function parseProductsSheet(wb: XLSX.WorkBook, errors: string[]): ParsedProduct[] {
  const rows = getSheetRows(wb, 'Products');
  if (!rows) {
    errors.push('Missing "Products" sheet');
    return [];
  }

  const headerIdx = findHeaderRow(rows, ['Product Name', 'Product Name *']);
  if (headerIdx < 0) {
    errors.push('Could not find header row in Products sheet');
    return [];
  }

  const products: ParsedProduct[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const name = str(row?.[0]);
    const sku = str(row?.[1]);
    const category = str(row?.[2]);
    if (!name && !sku) continue; // skip empty rows

    if (!name) { errors.push(`Products row ${i + 1}: missing product name`); continue; }
    if (!sku) { errors.push(`Products row ${i + 1}: missing SKU for "${name}"`); continue; }
    if (!category) { errors.push(`Products row ${i + 1}: missing category for "${name}"`); continue; }

    products.push({ name, sku, category });
  }

  if (products.length === 0) {
    errors.push('No products found in Products sheet');
  }

  return products;
}

// ── Ingredients sheet ──────────────────────────────────────────────────────

function parseIngredientsSheet(wb: XLSX.WorkBook, errors: string[]): ParsedIngredient[] {
  const rows = getSheetRows(wb, 'Ingredients');
  if (!rows) {
    errors.push('Missing "Ingredients" sheet');
    return [];
  }

  const headerIdx = findHeaderRow(rows, ['Product SKU', 'Product SKU *']);
  if (headerIdx < 0) {
    errors.push('Could not find header row in Ingredients sheet');
    return [];
  }

  const ingredients: ParsedIngredient[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const product_sku = str(row?.[0]);
    const name = str(row?.[1]);
    const quantity = num(row?.[2]);
    const unit = str(row?.[3]);
    const origin = str(row?.[4]) || null;

    if (!product_sku && !name) continue;

    if (!product_sku) { errors.push(`Ingredients row ${i + 1}: missing product SKU`); continue; }
    if (!name) { errors.push(`Ingredients row ${i + 1}: missing ingredient name`); continue; }
    if (quantity == null) { errors.push(`Ingredients row ${i + 1}: missing quantity for "${name}"`); continue; }
    if (!unit) { errors.push(`Ingredients row ${i + 1}: missing unit for "${name}"`); continue; }

    ingredients.push({ product_sku, name, quantity, unit, origin });
  }

  return ingredients;
}

// ── Packaging sheet ────────────────────────────────────────────────────────

function parsePackagingSheet(wb: XLSX.WorkBook, errors: string[]): ParsedPackaging[] {
  const rows = getSheetRows(wb, 'Packaging');
  if (!rows) {
    errors.push('Missing "Packaging" sheet');
    return [];
  }

  const headerIdx = findHeaderRow(rows, ['Product SKU', 'Product SKU *']);
  if (headerIdx < 0) {
    errors.push('Could not find header row in Packaging sheet');
    return [];
  }

  const packaging: ParsedPackaging[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const product_sku = str(row?.[0]);
    const name = str(row?.[1]);

    if (!product_sku && !name) continue;
    if (!product_sku) { errors.push(`Packaging row ${i + 1}: missing product SKU`); continue; }
    if (!name) { errors.push(`Packaging row ${i + 1}: missing packaging name`); continue; }

    const category = str(row?.[2]).toLowerCase();
    const main_material = str(row?.[3]).toLowerCase();
    const weight_g = num(row?.[4]);
    if (weight_g == null) { errors.push(`Packaging row ${i + 1}: missing weight for "${name}"`); continue; }

    // Parse up to 3 components
    const components: ParsedPackagingComponent[] = [];
    for (let c = 0; c < 3; c++) {
      const base = 17 + c * 4; // columns R/S/T/U, V/W/X/Y, Z/AA/AB/AC
      const cName = str(row?.[base]);
      const cMat = str(row?.[base + 1]);
      const cWeight = num(row?.[base + 2]);
      const cRecycled = num(row?.[base + 3]);
      if (cName && cMat) {
        components.push({
          name: cName,
          material: cMat.toLowerCase(),
          weight_g: cWeight,
          recycled_pct: cRecycled,
        });
      }
    }

    packaging.push({
      product_sku,
      name,
      category: enumVal(row?.[2], VALID_PACKAGING_CATEGORIES) || 'container',
      main_material,
      weight_g,
      net_content: num(row?.[5]),
      recycled_pct: num(row?.[6]),
      origin_country: str(row?.[7]) || null,
      transport_mode: enumVal(row?.[8], VALID_TRANSPORT_MODES),
      distance_km: num(row?.[9]),
      epr_level: enumVal(row?.[10], VALID_EPR_LEVELS),
      epr_activity: enumVal(row?.[11], VALID_EPR_ACTIVITIES),
      epr_material_type: str(row?.[12]).toLowerCase() || null,
      epr_is_household: yesNo(row?.[13]),
      epr_is_drinks_container: yesNo(row?.[14]),
      epr_ram_rating: enumVal(row?.[15], VALID_EPR_RAM_RATINGS),
      epr_uk_nation: enumVal(row?.[16], VALID_EPR_UK_NATIONS),
      components,
    });
  }

  return packaging;
}
