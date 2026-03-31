import * as XLSX from 'xlsx';

// ── Instructions sheet ──────────────────────────────────────────────────────

function buildInstructionsSheet(): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    ['alkatera — Orchard Data Collection Template'],
    [''],
    ['This template helps you collect environmental data from your fruit orchards for LCA calculations.'],
    ['Follow the steps below to get started.'],
    [''],
    [''],
    ['GETTING STARTED'],
    ['─────────────────────────────────────────────────────────────────────────'],
    [''],
    ['Step 1:', 'Go to the "Orchards" sheet and add your orchards (one row per orchard).'],
    ['Step 2:', 'Go to the "Growing Profiles" sheet and add annual data for each orchard (one row per orchard per harvest year).'],
    ['Step 3:', 'Save this file and upload it at alkatera.com/orchards/import.'],
    [''],
    [''],
    ['SHEET OVERVIEW'],
    ['─────────────────────────────────────────────────────────────────────────'],
    [''],
    ['Sheet', 'Purpose', 'Required?'],
    ['Orchards', 'Define each orchard with location, type, and tree details', 'Yes'],
    ['Growing Profiles', 'Annual harvest data: inputs, fuel, irrigation, yield, transport', 'Yes'],
    ['Example', 'A worked example showing a Normandy apple orchard for calvados production', 'No (reference only)'],
    ['Field Reference', 'Lists all allowed values for dropdown fields', 'No (reference only)'],
    [''],
    [''],
    ['TIPS'],
    ['─────────────────────────────────────────────────────────────────────────'],
    [''],
    ['', 'Each orchard needs a unique name. This is how growing profiles are linked to orchards.'],
    ['', 'You can leave optional fields blank. Required fields are marked with * in the column headers.'],
    ['', 'Check the "Example" sheet to see how a complete orchard entry looks.'],
    ['', 'The "Field Reference" sheet lists all valid options for type, certification, and management fields.'],
    ['', 'Transport distance is measured from the orchard to your processing facility (distillery, cider house, etc.).'],
    ['', 'For best LCA accuracy, provide data for 3 or more harvest years (we use median averaging).'],
    [''],
    [''],
    ['NEED HELP?'],
    ['─────────────────────────────────────────────────────────────────────────'],
    [''],
    ['', 'Contact support@alkatera.com or use the Rosa AI assistant in the platform.'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 16 }, { wch: 90 }, { wch: 20 }];
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  return ws;
}

// ── Orchards sheet ──────────────────────────────────────────────────────────

function buildOrchardsSheet(): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    ['ORCHARDS — Add one row per orchard'],
    ['Define your orchards below. The Orchard Name is used to link growing profiles on the other sheet.'],
    [''],
    [
      'Orchard Name *',
      'Hectares *',
      'Orchard Type *',
      'Fruit Varieties',
      'Certification',
      'Climate Zone',
      'Planting Year',
      'Tree Density (trees/ha)',
      'Rootstock Type',
      'Training System',
      'Country',
      'City',
      'Postcode',
      'Latitude',
      'Longitude',
      'Previous Land Use',
      'Land Conversion Year',
    ],
    ...Array(10).fill(null).map(() => Array(17).fill('') as string[]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 24 }, // Name
    { wch: 12 }, // Hectares
    { wch: 16 }, // Type
    { wch: 24 }, // Varieties
    { wch: 16 }, // Certification
    { wch: 14 }, // Climate
    { wch: 14 }, // Planting year
    { wch: 20 }, // Tree density
    { wch: 18 }, // Rootstock
    { wch: 16 }, // Training system
    { wch: 18 }, // Country
    { wch: 16 }, // City
    { wch: 14 }, // Postcode
    { wch: 12 }, // Lat
    { wch: 12 }, // Lng
    { wch: 20 }, // Previous land use
    { wch: 20 }, // Conversion year
  ];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 16 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 16 } },
  ];
  return ws;
}

// ── Growing Profiles sheet ──────────────────────────────────────────────────

function buildGrowingProfilesSheet(): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    ['GROWING PROFILES — Add one row per orchard per harvest year'],
    ['Link each profile to an orchard using the Orchard Name from the Orchards sheet. Provide data for each harvest year.'],
    [''],
    [
      'Orchard Name *',
      'Harvest Year *',
      'Area (ha) *',
      'Soil Management *',
      'Fertiliser Type',
      'Fertiliser Qty (kg)',
      'Fertiliser N%',
      'Pruning Residue Returned?',
      'Uses Pesticides?',
      'Pesticide Apps/yr',
      'Pesticide Type',
      'Uses Herbicides?',
      'Herbicide Apps/yr',
      'Herbicide Type',
      'Diesel (L/yr)',
      'Petrol (L/yr)',
      'Irrigated?',
      'Water (m3/ha)',
      'Irrigation Energy Source',
      'Fruit Yield (tonnes) *',
      'Transport Distance (km)',
      'Transport Mode',
    ],
    ...Array(10).fill(null).map(() => Array(22).fill('') as string[]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 24 }, // Orchard name
    { wch: 14 }, // Harvest year
    { wch: 12 }, // Area
    { wch: 22 }, // Soil management
    { wch: 18 }, // Fertiliser type
    { wch: 18 }, // Fertiliser qty
    { wch: 14 }, // Fertiliser N%
    { wch: 22 }, // Pruning
    { wch: 16 }, // Pesticides
    { wch: 16 }, // Pest apps
    { wch: 22 }, // Pest type
    { wch: 16 }, // Herbicides
    { wch: 16 }, // Herb apps
    { wch: 22 }, // Herb type
    { wch: 14 }, // Diesel
    { wch: 14 }, // Petrol
    { wch: 12 }, // Irrigated
    { wch: 14 }, // Water
    { wch: 22 }, // Irrigation source
    { wch: 20 }, // Yield
    { wch: 22 }, // Transport distance
    { wch: 16 }, // Transport mode
  ];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 21 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 21 } },
  ];
  return ws;
}

// ── Example sheet ───────────────────────────────────────────────────────────

function buildExampleSheet(): XLSX.WorkSheet {
  const rows: (string | number | null)[][] = [
    ['EXAMPLE — Normandy Apple Orchard (Calvados Production)'],
    ['This shows a complete orchard entry for Avallen calvados production. Use as a guide when filling in your own data.'],
    ['Delete or ignore this sheet when you upload. It will not be imported.'],
    [''],
    [''],
    ['ORCHARD'],
    ['Orchard Name', 'Hectares', 'Orchard Type', 'Fruit Varieties', 'Certification', 'Climate Zone',
     'Planting Year', 'Tree Density', 'Rootstock', 'Training System', 'Country', 'City'],
    ['Domaine des Pommiers', 15, 'apple', 'Bisquet, Mettais, Bedan, Frequin Rouge',
     'organic', 'temperate', 1985, 200, 'M25', 'bush', 'France', 'Domfront'],
    [''],
    [''],
    ['GROWING PROFILE (Harvest 2025)'],
    ['Field', 'Value', '', 'Notes'],
    ['Orchard Name', 'Domaine des Pommiers'],
    ['Harvest Year', 2025],
    ['Area (ha)', 15],
    ['Soil Management', 'cover_cropping', '', 'Inter-row cover crops maintained year-round'],
    ['Fertiliser Type', 'organic_compost', '', 'Local apple pomace compost returned to orchard'],
    ['Fertiliser Qty (kg)', 5000, '', '5 tonnes total across 15 ha'],
    ['Fertiliser N%', 1.5, '', '1.5% nitrogen content'],
    ['Pruning Residue Returned?', 'yes', '', 'Prunings chipped and returned to soil'],
    ['Uses Pesticides?', 'yes'],
    ['Pesticide Apps/yr', 4, '', '4 applications of sulfur fungicide per season'],
    ['Pesticide Type', 'sulfur', '', 'Permitted under organic certification'],
    ['Uses Herbicides?', 'no', '', 'Organic, no herbicide use'],
    ['Diesel (L/yr)', 800, '', 'Tractor operations: mowing, spraying, harvest transport'],
    ['Petrol (L/yr)', 50, '', 'Chainsaw for pruning'],
    ['Irrigated?', 'no', '', 'Normandy: sufficient rainfall (rainfed)'],
    ['Fruit Yield (tonnes)', 30, '', '30 tonnes total (2 t/ha, traditional low-density)'],
    ['Transport Distance (km)', 25, '', 'Orchard to Avallen distillery in Domfront'],
    ['Transport Mode', 'road', '', 'Local HGV delivery'],
    [''],
    [''],
    ['EXPECTED IMPACT SUMMARY'],
    ['', 'This orchard would produce approximately:'],
    ['', 'FLAG emissions: ~120 kg CO2e (N2O from fertiliser and crop residue)'],
    ['', 'Non-FLAG emissions: ~2,600 kg CO2e (fuel, fertiliser production, pesticide, transport)'],
    ['', 'Soil carbon removals: ~8,250 kg CO2e (cover cropping at 550 kg/ha/yr)'],
    ['', 'Per kg fruit: ~0.09 kg CO2e/kg apples'],
    ['', 'Per litre calvados: ~0.72 kg CO2e/L (at 8 kg apples per litre)'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 24 }, { wch: 40 }, { wch: 6 }, { wch: 60 }];
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
    ['Use this sheet as a lookup when filling in the Orchards and Growing Profiles sheets.'],
    [''],
    [''],
    ['ORCHARD TYPES'],
    ['Type', 'Description'],
    ['apple', 'Apple orchards (dessert, cider, calvados)'],
    ['pear', 'Pear orchards (including perry pear)'],
    ['cherry', 'Cherry orchards'],
    ['plum', 'Plum orchards (including damson, greengage)'],
    ['citrus', 'Citrus orchards (orange, lemon, lime, grapefruit)'],
    ['stone_fruit', 'Stone fruit (peach, apricot, nectarine)'],
    ['mixed', 'Mixed fruit orchard'],
    ['other', 'Other fruit type'],
    [''],
    [''],
    ['CERTIFICATION'],
    ['Certification', 'Description'],
    ['conventional', 'Standard/conventional farming'],
    ['organic', 'Certified organic'],
    ['biodynamic', 'Biodynamic certification'],
    ['other', 'Other certification scheme'],
    [''],
    [''],
    ['CLIMATE ZONE'],
    ['Zone', 'Description', 'IPCC N2O EF1'],
    ['wet', 'Wet/tropical climate', '0.016'],
    ['dry', 'Dry/arid climate', '0.005'],
    ['temperate', 'Temperate climate (most of UK/Europe)', '0.01'],
    [''],
    [''],
    ['TRAINING SYSTEM'],
    ['System', 'Description'],
    ['bush', 'Bush/gobelet (traditional low-density)'],
    ['spindle', 'Spindle (modern high-density)'],
    ['espalier', 'Espalier (flat, trained against wall/wire)'],
    ['trellis', 'Trellis system'],
    ['central_leader', 'Central leader (single trunk)'],
    ['open_vase', 'Open vase/open centre'],
    ['other', 'Other training system'],
    [''],
    [''],
    ['SOIL MANAGEMENT'],
    ['Practice', 'Description', 'Soil Carbon Removal (kg CO2e/ha/yr)'],
    ['conventional_tillage', 'Regular tillage between rows', '0'],
    ['minimum_tillage', 'Reduced tillage, shallow cultivation only', '175'],
    ['no_till', 'No mechanical soil disturbance', '400'],
    ['cover_cropping', 'Permanent cover crops between rows', '550'],
    ['composting', 'Regular compost/organic matter additions', '350'],
    ['biochar_compost', 'Biochar-compost amendment', '750'],
    ['regenerative_integrated', 'Integrated regenerative (cover crops + min till + compost)', '650'],
    [''],
    [''],
    ['FERTILISER TYPE'],
    ['Type', 'Description'],
    ['none', 'No fertiliser applied'],
    ['synthetic_n', 'Synthetic nitrogen fertiliser (e.g. ammonium nitrate, urea)'],
    ['organic_manure', 'Animal manure'],
    ['organic_compost', 'Compost (including pomace compost)'],
    ['mixed', 'Combination of synthetic and organic'],
    [''],
    [''],
    ['PESTICIDE TYPE (Orchards)'],
    ['Type', 'Description'],
    ['generic', 'Generic/unspecified pesticide'],
    ['sulfur', 'Elemental sulfur (low toxicity, organic-approved)'],
    ['mancozeb', 'Mancozeb (dithiocarbamate fungicide)'],
    ['synthetic_fungicide', 'Other synthetic fungicide'],
    ['insecticide_codling_moth', 'Codling moth control (granulosis virus, spinosad)'],
    ['insecticide_aphid', 'Aphid control (neonicotinoid, pyrethroid)'],
    ['herbicide_glyphosate', 'Glyphosate-based herbicide'],
    [''],
    [''],
    ['IRRIGATION ENERGY SOURCE'],
    ['Source', 'Description'],
    ['none', 'Rainfed, no irrigation'],
    ['grid_electricity', 'Electric pump from mains grid'],
    ['diesel_pump', 'Diesel-powered pump'],
    ['solar_pump', 'Solar-powered pump'],
    ['gravity_fed', 'Gravity-fed (no energy needed)'],
    [''],
    [''],
    ['TRANSPORT MODE'],
    ['Mode', 'Description', 'Emission Factor (kg CO2e/tonne-km)'],
    ['road', 'Road freight (HGV)', '0.10516'],
    ['rail', 'Rail freight', '0.02768'],
    [''],
    [''],
    ['PREVIOUS LAND USE (for dLUC calculation)'],
    ['Land Use', 'Description'],
    ['permanent_orchard', 'Already an orchard (no land use change)'],
    ['grassland', 'Previously grassland/pasture'],
    ['forest', 'Previously forest/woodland'],
    ['arable', 'Previously arable cropland'],
    ['wetland', 'Previously wetland'],
    ['settlement', 'Previously built-up/settlement'],
    ['other_land', 'Other land use'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 28 }, { wch: 60 }, { wch: 30 }];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
  ];
  return ws;
}

// ── XLSX Generation ─────────────────────────────────────────────────────────

/**
 * Generate and download the orchard data collection template as an XLSX file.
 *
 * Sheets:
 * 1. Instructions - how to use the template
 * 2. Orchards - one row per orchard
 * 3. Growing Profiles - one row per orchard per harvest year
 * 4. Example - worked Normandy apple orchard for calvados
 * 5. Field Reference - all allowed values
 */
export function downloadOrchardTemplateAsXLSX(): void {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, buildInstructionsSheet(), 'Instructions');
  XLSX.utils.book_append_sheet(wb, buildOrchardsSheet(), 'Orchards');
  XLSX.utils.book_append_sheet(wb, buildGrowingProfilesSheet(), 'Growing Profiles');
  XLSX.utils.book_append_sheet(wb, buildExampleSheet(), 'Example');
  XLSX.utils.book_append_sheet(wb, buildReferenceSheet(), 'Field Reference');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'alkatera-orchard-data-template.xlsx';
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
