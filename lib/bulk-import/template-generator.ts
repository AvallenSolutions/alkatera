import * as XLSX from 'xlsx';

// ── Products sheet ──────────────────────────────────────────────────────────

const PRODUCT_HEADERS = [
  'product_name',
  'product_sku',
  'product_category',
];

const PRODUCT_EXAMPLES = [
  ['Example Gin', 'GIN-001', 'Gin'],
  ['Example Wine', 'WINE-001', 'Red Wine'],
];

// ── Ingredients sheet ───────────────────────────────────────────────────────

const INGREDIENT_HEADERS = [
  'product_sku',
  'ingredient_name',
  'ingredient_quantity',
  'ingredient_unit',
  'origin_country',
];

const INGREDIENT_EXAMPLES = [
  ['GIN-001', 'Juniper Berries', 5, 'kg', 'Italy'],
  ['GIN-001', 'Neutral Grain Spirit', 100, 'L', 'United Kingdom'],
  ['WINE-001', 'Grapes (Merlot)', 800, 'kg', 'France'],
];

// ── Packaging sheet (includes EPR fields) ───────────────────────────────────

const PACKAGING_HEADERS = [
  // Core packaging fields
  'product_sku',
  'packaging_name',
  'packaging_category',
  'packaging_material',
  'packaging_weight_g',
  'net_weight_g',
  'recycled_content_percentage',
  'origin_country',
  'transport_mode',
  'distance_km',
  // EPR Compliance fields
  'epr_packaging_level',
  'epr_packaging_activity',
  'epr_material_type',
  'epr_is_household',
  'epr_is_drinks_container',
  'epr_ram_rating',
  'epr_uk_nation',
  // Component breakdown (up to 3 components inline)
  'component_1_name',
  'component_1_material_type',
  'component_1_weight_g',
  'component_1_recycled_pct',
  'component_2_name',
  'component_2_material_type',
  'component_2_weight_g',
  'component_2_recycled_pct',
  'component_3_name',
  'component_3_material_type',
  'component_3_weight_g',
  'component_3_recycled_pct',
];

const PACKAGING_EXAMPLES = [
  [
    'GIN-001', '700ml Glass Bottle', 'container', 'Glass', 450, 700,
    30, 'United Kingdom', 'truck', 150,
    'primary', 'packed_filled', 'glass', 'yes', 'yes', 'green', 'england',
    'Glass body', 'glass', 430, 30,
    'Label', 'paper_cardboard', 15, 0,
    'Ink', 'ink', 5, 0,
  ],
  [
    'GIN-001', 'Aluminium Cap', 'closure', 'Aluminium', 8, '',
    0, 'United Kingdom', 'truck', 150,
    'primary', 'packed_filled', 'aluminium', 'yes', '', 'green', 'england',
    'Cap body', 'aluminium', 7, 0,
    'Liner', 'plastic_rigid', 1, 0,
    '', '', '', '',
  ],
  [
    'GIN-001', 'Cardboard Gift Box', 'secondary', 'Cardboard', 120, '',
    80, 'United Kingdom', 'truck', 50,
    'secondary', 'brand', 'paper_cardboard', 'yes', '', 'green', 'england',
    'Cardboard', 'paper_cardboard', 115, 80,
    'Ink', 'ink', 3, 0,
    'Coating', 'coating', 2, 0,
  ],
  [
    'WINE-001', '750ml Wine Bottle', 'container', 'Glass', 500, 750,
    40, 'France', 'truck', 200,
    'primary', 'imported', 'glass', 'yes', 'yes', 'green', 'england',
    'Glass body', 'glass', 490, 40,
    'Label', 'paper_cardboard', 8, 0,
    'Ink', 'ink', 2, 0,
  ],
  [
    'WINE-001', 'Cork', 'closure', 'Cork', 6, '',
    0, 'Portugal', 'truck', 1800,
    'primary', 'imported', 'other', 'yes', '', 'green', 'england',
    'Natural cork', 'other', 6, 0,
    '', '', '', '',
    '', '', '', '',
  ],
];

// ── Reference sheet ─────────────────────────────────────────────────────────

function buildReferenceData(): string[][] {
  return [
    ['Field', 'Allowed Values', 'Description'],
    [''],
    ['── Product Fields ──'],
    ['product_category', 'Gin, Vodka, Rum, Whisky, Bourbon, Tequila, Brandy, Liqueur, Red Wine, White Wine, Rosé, Sparkling Wine, Lager, Ale, IPA, Stout, Cider, Hard Seltzer, RTD Cocktail, Non-Alcoholic Spirit, Non-Alcoholic Beer, Non-Alcoholic Wine, Kombucha, Other', 'Product type / sub-category'],
    [''],
    ['── Ingredient Fields ──'],
    ['ingredient_unit', 'kg, g, L, ml, unit', 'Quantity unit'],
    [''],
    ['── Packaging Fields ──'],
    ['packaging_category', 'container, label, closure, secondary, shipment, tertiary', 'Type of packaging'],
    ['transport_mode', 'truck, train, ship, air', 'How the packaging is transported to your facility'],
    [''],
    ['── EPR Compliance Fields ──'],
    ['epr_packaging_level', 'primary, secondary, tertiary, shipment', 'UK EPR packaging class'],
    ['epr_packaging_activity', 'brand, packed_filled, imported, empty, hired, marketplace', 'How packaging was supplied'],
    ['epr_material_type', 'aluminium, fibre_composite, glass, paper_cardboard, plastic_rigid, plastic_flexible, steel, wood, other', 'Main EPR material category for the item'],
    ['epr_is_household', 'yes, no', 'Whether packaging ends up in household waste stream'],
    ['epr_is_drinks_container', 'yes, no', 'Drinks container 150ml–3L (containers only)'],
    ['epr_ram_rating', 'green, amber, red', 'RAM recyclability rating — green = recyclable, amber = some issues, red = not recyclable'],
    ['epr_uk_nation', 'england, scotland, wales, northern_ireland', 'UK nation where packaging is placed on market'],
    [''],
    ['── Component Material Types ──'],
    ['component_N_material_type', 'aluminium, fibre_composite, glass, paper_cardboard, plastic_rigid, plastic_flexible, steel, wood, other, adhesive, ink, coating, lacquer', 'Material type for sub-component (e.g. label ink, cap liner)'],
    ['component_N_recycled_pct', '0–100', 'Percentage of recycled content in this component'],
  ];
}

// ── XLSX Generation ─────────────────────────────────────────────────────────

/**
 * Generate and download the product import template as an XLSX file
 * with separate sheets for Products, Ingredients, Packaging (with EPR), and a Reference sheet.
 */
export function downloadTemplateAsXLSX(): void {
  const wb = XLSX.utils.book_new();

  // Products sheet
  const productsData = [PRODUCT_HEADERS, ...PRODUCT_EXAMPLES];
  const wsProducts = XLSX.utils.aoa_to_sheet(productsData);
  applyHeaderStyle(wsProducts, PRODUCT_HEADERS.length);
  wsProducts['!cols'] = PRODUCT_HEADERS.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, wsProducts, 'Products');

  // Ingredients sheet
  const ingredientsData = [INGREDIENT_HEADERS, ...INGREDIENT_EXAMPLES];
  const wsIngredients = XLSX.utils.aoa_to_sheet(ingredientsData);
  applyHeaderStyle(wsIngredients, INGREDIENT_HEADERS.length);
  wsIngredients['!cols'] = INGREDIENT_HEADERS.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, wsIngredients, 'Ingredients');

  // Packaging sheet (with EPR fields)
  const packagingData = [PACKAGING_HEADERS, ...PACKAGING_EXAMPLES];
  const wsPackaging = XLSX.utils.aoa_to_sheet(packagingData);
  applyHeaderStyle(wsPackaging, PACKAGING_HEADERS.length);
  wsPackaging['!cols'] = PACKAGING_HEADERS.map((h) => ({
    wch: Math.max(h.length + 2, 18),
  }));
  XLSX.utils.book_append_sheet(wb, wsPackaging, 'Packaging');

  // Reference sheet
  const refData = buildReferenceData();
  const wsRef = XLSX.utils.aoa_to_sheet(refData);
  wsRef['!cols'] = [{ wch: 28 }, { wch: 80 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsRef, 'Reference');

  // Trigger download
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'alkatera-product-import-template.xlsx';
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** Mark the first row cells as bold (SheetJS community doesn't support styles natively, but we set column widths) */
function applyHeaderStyle(ws: XLSX.WorkSheet, colCount: number): void {
  // SheetJS community edition doesn't support cell styles,
  // but setting column widths helps readability.
  // The header row is already the first row by construction.
  if (!ws['!cols']) ws['!cols'] = [];
  for (let i = 0; i < colCount; i++) {
    if (!ws['!cols'][i]) ws['!cols'][i] = {};
  }
}

// ── Legacy CSV functions (kept for backward compat) ─────────────────────────

export function downloadTemplateAsCSV(): void {
  // Redirect to XLSX download for richer template
  downloadTemplateAsXLSX();
}

export function createGoogleSheetsTemplate(): string {
  return 'https://docs.google.com/spreadsheets/d/create';
}

export function generateTemplateHeaders(): string[] {
  return [
    ...PRODUCT_HEADERS,
    ...INGREDIENT_HEADERS.filter((h) => h !== 'product_sku'),
    ...PACKAGING_HEADERS.filter((h) => h !== 'product_sku'),
  ];
}
