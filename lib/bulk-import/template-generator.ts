import * as XLSX from 'xlsx';

// ── Instructions sheet ──────────────────────────────────────────────────────

function buildInstructionsSheet(): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    ['AlkaTera — Product Import Template'],
    [''],
    ['Welcome! This template helps you import your products, ingredients, and packaging data into AlkaTera.'],
    ['Follow the steps below to get started.'],
    [''],
    [''],
    ['GETTING STARTED'],
    ['─────────────────────────────────────────────────────────────────────────'],
    [''],
    ['Step 1:', 'Go to the "Products" sheet and add your products (one row per product).'],
    ['Step 2:', 'Go to the "Ingredients" sheet and add each ingredient, linking it to a product using the Product SKU.'],
    ['Step 3:', 'Go to the "Packaging" sheet and add each packaging item, again linking by Product SKU.'],
    ['Step 4:', 'Save this file and upload it at alkatera.com/products/import.'],
    [''],
    [''],
    ['SHEET OVERVIEW'],
    ['─────────────────────────────────────────────────────────────────────────'],
    [''],
    ['Sheet', 'Purpose', 'Required?'],
    ['Products', 'Define each product with a name, SKU, and category', 'Yes'],
    ['Ingredients', 'List the ingredients/raw materials for each product', 'Yes'],
    ['Packaging', 'Describe packaging items including EPR compliance data', 'Yes'],
    ['Example Product', 'A fully worked example showing a London Dry Gin — use as a guide', 'No (reference only)'],
    ['Field Reference', 'Lists all allowed values for dropdown fields', 'No (reference only)'],
    [''],
    [''],
    ['TIPS'],
    ['─────────────────────────────────────────────────────────────────────────'],
    [''],
    ['', 'Each product needs a unique SKU — this is how ingredients and packaging are linked to products.'],
    ['', 'You can leave optional fields blank. Required fields are marked with * in the column headers.'],
    ['', 'Check the "Example Product" sheet to see how a complete product looks.'],
    ['', 'The "Field Reference" sheet lists all valid options for category, material type, and EPR fields.'],
    ['', 'EPR fields are optional but recommended if you report under UK Extended Producer Responsibility.'],
    ['', 'Component breakdowns (component_1, _2, _3) let you specify sub-materials (e.g. ink, adhesive on a label).'],
    [''],
    [''],
    ['NEED HELP?'],
    ['─────────────────────────────────────────────────────────────────────────'],
    [''],
    ['', 'Contact support@alkatera.com or use the Rosa AI assistant in the platform.'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 16 }, { wch: 90 }, { wch: 20 }];
  // Merge the title row across columns
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  return ws;
}

// ── Products sheet ──────────────────────────────────────────────────────────

function buildProductsSheet(): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    ['PRODUCTS — Add one row per product'],
    ['Fill in your products below. The SKU is used to link ingredients and packaging on the other sheets.'],
    [''],
    ['Product Name *', 'Product SKU *', 'Product Category *'],
    ['', '', ''],
    ['', '', ''],
    ['', '', ''],
    ['', '', ''],
    ['', '', ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 25 }];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
  ];
  return ws;
}

// ── Ingredients sheet ───────────────────────────────────────────────────────

function buildIngredientsSheet(): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    ['INGREDIENTS — Add one row per ingredient per product'],
    ['Link each ingredient to a product using the Product SKU from the Products sheet.'],
    [''],
    [
      'Product SKU *',
      'Ingredient Name *',
      'Quantity *',
      'Unit *',
      'Origin Country',
    ],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 18 },
    { wch: 30 },
    { wch: 12 },
    { wch: 10 },
    { wch: 22 },
  ];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
  ];
  return ws;
}

// ── Packaging sheet ─────────────────────────────────────────────────────────

function buildPackagingSheet(): XLSX.WorkSheet {
  const headerDescriptions = [
    'PACKAGING — Add one row per packaging item per product',
    'Link each item to a product using the Product SKU. EPR fields (columns K–Q) are optional but recommended for UK EPR reporting.',
  ];

  const groupHeaderRow = [
    '', '', '', '── Core Details ──', '', '', '', '', '', '',
    '── EPR Compliance (optional) ──', '', '', '', '', '', '',
    '── Component Breakdown (optional) ──', '', '', '',
    '', '', '', '',
    '', '', '', '',
  ];

  const headerRow = [
    'Product SKU *',
    'Packaging Name *',
    'Category *',
    'Main Material *',
    'Weight (g) *',
    'Net Content (g/ml)',
    'Recycled %',
    'Origin Country',
    'Transport Mode',
    'Distance (km)',
    'EPR Level',
    'EPR Activity',
    'EPR Material Type',
    'Household?',
    'Drinks Container?',
    'RAM Rating',
    'UK Nation',
    'Comp. 1 Name',
    'Comp. 1 Material',
    'Comp. 1 Weight (g)',
    'Comp. 1 Recycled %',
    'Comp. 2 Name',
    'Comp. 2 Material',
    'Comp. 2 Weight (g)',
    'Comp. 2 Recycled %',
    'Comp. 3 Name',
    'Comp. 3 Material',
    'Comp. 3 Weight (g)',
    'Comp. 3 Recycled %',
  ];

  const rows: (string | number)[][] = [
    [headerDescriptions[0]],
    [headerDescriptions[1]],
    [''],
    groupHeaderRow,
    headerRow,
    // Empty rows for user data
    Array(29).fill('') as string[],
    Array(29).fill('') as string[],
    Array(29).fill('') as string[],
    Array(29).fill('') as string[],
    Array(29).fill('') as string[],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  ws['!cols'] = [
    { wch: 16 }, // SKU
    { wch: 24 }, // Name
    { wch: 14 }, // Category
    { wch: 16 }, // Material
    { wch: 12 }, // Weight
    { wch: 16 }, // Net content
    { wch: 12 }, // Recycled %
    { wch: 18 }, // Country
    { wch: 16 }, // Transport
    { wch: 14 }, // Distance
    { wch: 14 }, // EPR Level
    { wch: 18 }, // EPR Activity
    { wch: 18 }, // EPR Material
    { wch: 14 }, // Household
    { wch: 18 }, // Drinks container
    { wch: 14 }, // RAM
    { wch: 16 }, // Nation
    { wch: 16 }, // C1 name
    { wch: 16 }, // C1 material
    { wch: 16 }, // C1 weight
    { wch: 16 }, // C1 recycled
    { wch: 16 }, // C2 name
    { wch: 16 }, // C2 material
    { wch: 16 }, // C2 weight
    { wch: 16 }, // C2 recycled
    { wch: 16 }, // C3 name
    { wch: 16 }, // C3 material
    { wch: 16 }, // C3 weight
    { wch: 16 }, // C3 recycled
  ];

  // Merge description rows and group header sections
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 28 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 28 } },
    // Group headers
    { s: { r: 3, c: 3 }, e: { r: 3, c: 9 } },
    { s: { r: 3, c: 10 }, e: { r: 3, c: 16 } },
    { s: { r: 3, c: 17 }, e: { r: 3, c: 28 } },
  ];

  return ws;
}

// ── Example Product sheet ───────────────────────────────────────────────────

function buildExampleSheet(): XLSX.WorkSheet {
  const rows: (string | number | null)[][] = [
    ['EXAMPLE — London Dry Gin (700ml)'],
    ['This shows a complete product entry. Use this as a guide when filling in your own data.'],
    ['Delete or ignore this sheet when you upload — it will not be imported.'],
    [''],
    [''],
    // ── Product section
    ['PRODUCT'],
    ['Product Name', 'Product SKU', 'Product Category'],
    ['Oakwood London Dry Gin', 'OAK-GIN-700', 'Gin'],
    [''],
    [''],
    // ── Ingredients section
    ['INGREDIENTS'],
    ['Product SKU', 'Ingredient Name', 'Quantity', 'Unit', 'Origin Country'],
    ['OAK-GIN-700', 'Neutral Grain Spirit (Wheat)', 100, 'L', 'United Kingdom'],
    ['OAK-GIN-700', 'Juniper Berries', 4.5, 'kg', 'Italy'],
    ['OAK-GIN-700', 'Coriander Seeds', 1.2, 'kg', 'Morocco'],
    ['OAK-GIN-700', 'Angelica Root', 0.8, 'kg', 'Poland'],
    ['OAK-GIN-700', 'Citrus Peel (Lemon)', 0.5, 'kg', 'Spain'],
    ['OAK-GIN-700', 'Orris Root', 0.3, 'kg', 'Italy'],
    ['OAK-GIN-700', 'Water (Demineralised)', 60, 'L', 'United Kingdom'],
    [''],
    [''],
    // ── Packaging section
    ['PACKAGING'],
    [''],
    ['Item 1: Glass Bottle'],
    ['Field', 'Value', '', 'Notes'],
    ['Product SKU', 'OAK-GIN-700'],
    ['Packaging Name', '700ml Flint Glass Bottle'],
    ['Category', 'container', '', 'The primary container holding the product'],
    ['Main Material', 'Glass'],
    ['Weight (g)', 450, '', 'Total weight of the empty bottle'],
    ['Net Content (g/ml)', 700, '', 'Volume of liquid the bottle holds'],
    ['Recycled Content %', 30, '', 'Percentage of recycled glass used'],
    ['Origin Country', 'United Kingdom'],
    ['Transport Mode', 'truck'],
    ['Distance (km)', 120],
    ['', ''],
    ['EPR Level', 'primary', '', 'Primary = directly contains the product'],
    ['EPR Activity', 'packed_filled', '', 'You pack/fill this packaging'],
    ['EPR Material Type', 'glass', '', 'Main material for EPR reporting'],
    ['Household?', 'yes', '', 'Ends up in household waste'],
    ['Drinks Container?', 'yes', '', 'Yes for bottles 150ml–3L'],
    ['RAM Rating', 'green', '', 'Green = fully recyclable'],
    ['UK Nation', 'england', '', 'Where placed on market'],
    ['', ''],
    ['Component 1', 'Glass body', 'glass', '430g — 30% recycled content'],
    ['Component 2', 'Paper label', 'paper_cardboard', '15g — 0% recycled'],
    ['Component 3', 'Printing ink', 'ink', '5g'],
    [''],
    [''],
    ['Item 2: Aluminium Screw Cap'],
    ['Field', 'Value', '', 'Notes'],
    ['Product SKU', 'OAK-GIN-700'],
    ['Packaging Name', 'Aluminium Screw Cap'],
    ['Category', 'closure'],
    ['Main Material', 'Aluminium'],
    ['Weight (g)', 8],
    ['Recycled Content %', 0],
    ['Origin Country', 'United Kingdom'],
    ['Transport Mode', 'truck'],
    ['Distance (km)', 120],
    ['', ''],
    ['EPR Level', 'primary'],
    ['EPR Activity', 'packed_filled'],
    ['EPR Material Type', 'aluminium'],
    ['Household?', 'yes'],
    ['RAM Rating', 'green'],
    ['UK Nation', 'england'],
    ['', ''],
    ['Component 1', 'Aluminium shell', 'aluminium', '7g'],
    ['Component 2', 'Plastic liner', 'plastic_rigid', '1g'],
    [''],
    [''],
    ['Item 3: Self-Adhesive Label'],
    ['Field', 'Value', '', 'Notes'],
    ['Product SKU', 'OAK-GIN-700'],
    ['Packaging Name', 'Front & Back Labels'],
    ['Category', 'label'],
    ['Main Material', 'Paper'],
    ['Weight (g)', 12],
    ['Recycled Content %', 0],
    ['Origin Country', 'United Kingdom'],
    ['Transport Mode', 'truck'],
    ['Distance (km)', 30],
    ['', ''],
    ['EPR Level', 'primary'],
    ['EPR Activity', 'packed_filled'],
    ['EPR Material Type', 'paper_cardboard'],
    ['Household?', 'yes'],
    ['RAM Rating', 'amber', '', 'Amber — adhesive affects recyclability'],
    ['UK Nation', 'england'],
    ['', ''],
    ['Component 1', 'Paper substrate', 'paper_cardboard', '10g'],
    ['Component 2', 'Self-adhesive', 'adhesive', '1.5g'],
    ['Component 3', 'Printing ink', 'ink', '0.5g'],
    [''],
    [''],
    ['Item 4: Shipping Case (6-pack)'],
    ['Field', 'Value', '', 'Notes'],
    ['Product SKU', 'OAK-GIN-700'],
    ['Packaging Name', '6-Bottle Shipping Case'],
    ['Category', 'shipment', '', 'Trade/logistics packaging'],
    ['Main Material', 'Cardboard'],
    ['Weight (g)', 380],
    ['Recycled Content %', 90],
    ['Origin Country', 'United Kingdom'],
    ['Transport Mode', 'truck'],
    ['Distance (km)', 50],
    ['', ''],
    ['EPR Level', 'shipment'],
    ['EPR Activity', 'packed_filled'],
    ['EPR Material Type', 'paper_cardboard'],
    ['Household?', 'no', '', 'B2B packaging — not household'],
    ['RAM Rating', 'green'],
    ['UK Nation', 'england'],
    ['', ''],
    ['Component 1', 'Corrugated cardboard', 'paper_cardboard', '370g — 90% recycled'],
    ['Component 2', 'Printing ink', 'ink', '5g'],
    ['Component 3', 'Tape', 'plastic_flexible', '5g'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 22 }, { wch: 32 }, { wch: 20 }, { wch: 50 }];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
  ];
  return ws;
}

// ── Field Reference sheet ───────────────────────────────────────────────────

function buildReferenceSheet(): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    ['FIELD REFERENCE — Allowed values for each field'],
    ['Use this sheet as a lookup when filling in the Products, Ingredients, and Packaging sheets.'],
    [''],
    [''],
    ['PRODUCT CATEGORIES'],
    ['Category', 'Description'],
    ['Gin', 'London Dry, Old Tom, etc.'],
    ['Vodka', ''],
    ['Rum', 'White, Dark, Spiced, etc.'],
    ['Whisky', 'Scotch, Irish, Japanese, etc.'],
    ['Bourbon', ''],
    ['Tequila', ''],
    ['Brandy', 'Including Cognac, Armagnac'],
    ['Liqueur', ''],
    ['Red Wine', ''],
    ['White Wine', ''],
    ['Rosé', ''],
    ['Sparkling Wine', 'Including Champagne, Prosecco, Cava'],
    ['Lager', ''],
    ['Ale', 'Including Pale Ale, Bitter'],
    ['IPA', ''],
    ['Stout', 'Including Porter'],
    ['Cider', ''],
    ['Hard Seltzer', ''],
    ['RTD Cocktail', 'Ready-to-drink cocktails'],
    ['Non-Alcoholic Spirit', ''],
    ['Non-Alcoholic Beer', ''],
    ['Non-Alcoholic Wine', ''],
    ['Kombucha', ''],
    ['Other', 'Anything not listed above'],
    [''],
    [''],
    ['INGREDIENT UNITS'],
    ['Unit', 'Description'],
    ['kg', 'Kilograms'],
    ['g', 'Grams'],
    ['L', 'Litres'],
    ['ml', 'Millilitres'],
    ['unit', 'Individual items (e.g. 1 cork)'],
    [''],
    [''],
    ['PACKAGING CATEGORIES'],
    ['Category', 'Description', 'Example'],
    ['container', 'Primary container holding the product', 'Glass bottle, can, pouch'],
    ['label', 'Labels, stickers, tamper seals', 'Front label, back label, neck label'],
    ['closure', 'Caps, corks, lids, seals', 'Screw cap, cork, crown cap'],
    ['secondary', 'Retail/gift packaging', 'Gift box, carton, tube'],
    ['shipment', 'Trade cases and B2B logistics', '6-pack case, pallet wrap'],
    ['tertiary', 'Bulk transport packaging', 'Pallet, stretch wrap, slip sheet'],
    [''],
    [''],
    ['TRANSPORT MODES'],
    ['Mode', 'When to use'],
    ['truck', 'Road freight (most common for domestic)'],
    ['train', 'Rail freight'],
    ['ship', 'Sea freight (international shipments)'],
    ['air', 'Air freight (rarely used for packaging)'],
    [''],
    [''],
    ['EPR PACKAGING LEVELS'],
    ['Level', 'Description'],
    ['primary', 'Packaging in direct contact with the product (bottle, label, cap)'],
    ['secondary', 'Groups primary packaging for retail (gift box, multipack)'],
    ['tertiary', 'Used for bulk transport (pallet wrap, shipping container)'],
    ['shipment', 'Trade/logistics packaging (cases for B2B distribution)'],
    [''],
    [''],
    ['EPR PACKAGING ACTIVITIES'],
    ['Activity', 'Description'],
    ['brand', 'Packaging supplied under your brand name'],
    ['packed_filled', 'You pack or fill this packaging with product'],
    ['imported', 'You are the first UK owner of imported packaging'],
    ['empty', 'You supply empty packaging to others'],
    ['hired', 'Packaging that is hired or loaned'],
    ['marketplace', 'Packaging from an online marketplace you operate'],
    [''],
    [''],
    ['EPR MATERIAL TYPES (main item)'],
    ['Material', 'Description'],
    ['aluminium', 'Aluminium cans, foil, caps'],
    ['fibre_composite', 'Fibre-based composites (e.g. Tetra Pak)'],
    ['glass', 'Glass bottles, jars'],
    ['paper_cardboard', 'Paper, card, corrugated board'],
    ['plastic_rigid', 'Rigid plastics (PET, HDPE bottles, caps)'],
    ['plastic_flexible', 'Flexible plastics (films, wraps, pouches)'],
    ['steel', 'Steel cans, drums'],
    ['wood', 'Wooden crates, pallets'],
    ['other', 'Cork, ceramic, bamboo, silicone, etc.'],
    [''],
    [''],
    ['COMPONENT MATERIAL TYPES (sub-materials)'],
    ['Material', 'Typical use'],
    ['All of the above, plus:'],
    ['adhesive', 'Glue on labels, tape adhesive'],
    ['ink', 'Printing ink on labels, boxes'],
    ['coating', 'Protective coatings, varnish'],
    ['lacquer', 'Decorative or protective lacquer'],
    [''],
    [''],
    ['RAM RECYCLABILITY RATINGS'],
    ['Rating', 'Meaning'],
    ['green', 'Recyclable — collected and sorted for recycling in practice'],
    ['amber', 'Some recyclability issues (e.g. adhesive labels, mixed materials)'],
    ['red', 'Not recyclable in practice'],
    [''],
    [''],
    ['UK NATIONS'],
    ['Nation', ''],
    ['england', ''],
    ['scotland', ''],
    ['wales', ''],
    ['northern_ireland', ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 24 }, { wch: 60 }, { wch: 40 }];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
  ];
  return ws;
}

// ── XLSX Generation ─────────────────────────────────────────────────────────

/**
 * Generate and download the product import template as an XLSX file.
 *
 * Sheets:
 * 1. Instructions — how to use the template
 * 2. Products — one row per product
 * 3. Ingredients — one row per ingredient, linked by SKU
 * 4. Packaging — one row per packaging item with EPR fields, linked by SKU
 * 5. Example Product — fully worked London Dry Gin example
 * 6. Field Reference — all allowed values
 */
export function downloadTemplateAsXLSX(): void {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, buildInstructionsSheet(), 'Instructions');
  XLSX.utils.book_append_sheet(wb, buildProductsSheet(), 'Products');
  XLSX.utils.book_append_sheet(wb, buildIngredientsSheet(), 'Ingredients');
  XLSX.utils.book_append_sheet(wb, buildPackagingSheet(), 'Packaging');
  XLSX.utils.book_append_sheet(wb, buildExampleSheet(), 'Example Product');
  XLSX.utils.book_append_sheet(wb, buildReferenceSheet(), 'Field Reference');

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

// ── Legacy functions (kept for backward compat) ─────────────────────────────

export function downloadTemplateAsCSV(): void {
  downloadTemplateAsXLSX();
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
