import * as XLSX from 'xlsx';

// ── Instructions sheet ──────────────────────────────────────────────────────

function buildInstructionsSheet(): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    ['alkatera — Vineyard Data Collection Template'],
    [''],
    ['This template helps you collect environmental data from your vineyards for LCA calculations.'],
    ['Follow the steps below to get started.'],
    [''],
    [''],
    ['GETTING STARTED'],
    ['─────────────────────────────────────────────────────────────────────────'],
    [''],
    ['Step 1:', 'Go to the "Vineyards" sheet and add your vineyards (one row per vineyard).'],
    ['Step 2:', 'Go to the "Growing Profiles" sheet and add annual data for each vineyard (one row per vineyard per vintage year).'],
    ['Step 3:', 'Save this file and upload it at alkatera.com/vineyards/import.'],
    [''],
    [''],
    ['SHEET OVERVIEW'],
    ['─────────────────────────────────────────────────────────────────────────'],
    [''],
    ['Sheet', 'Purpose', 'Required?'],
    ['Vineyards', 'Define each vineyard with location, varieties, and certification', 'Yes'],
    ['Growing Profiles', 'Annual vintage data: inputs, fuel, irrigation, yield', 'Yes'],
    ['Example', 'A worked example showing a Burgundy Pinot Noir vineyard', 'No (reference only)'],
    ['Field Reference', 'Lists all allowed values for dropdown fields', 'No (reference only)'],
    [''],
    [''],
    ['TIPS'],
    ['─────────────────────────────────────────────────────────────────────────'],
    [''],
    ['', 'Each vineyard needs a unique name. This is how growing profiles are linked to vineyards.'],
    ['', 'You can leave optional fields blank. Required fields are marked with * in the column headers.'],
    ['', 'Check the "Example" sheet to see how a complete vineyard entry looks.'],
    ['', 'The "Field Reference" sheet lists all valid options for certification, soil management, and other fields.'],
    ['', 'For best LCA accuracy, provide data for 3 or more vintage years (we use median averaging).'],
    ['', 'If you have soil carbon lab results, include them in the optional soil carbon columns.'],
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

// ── Vineyards sheet ──────────────────────────────────────────────────────────

function buildVineyardsSheet(): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    ['VINEYARDS — Add one row per vineyard'],
    ['Define your vineyards below. The Vineyard Name is used to link growing profiles on the other sheet.'],
    [''],
    [
      'Vineyard Name *',
      'Hectares *',
      'Grape Varieties',
      'Certification',
      'Climate Zone',
      'Annual Yield (tonnes)',
      'Country',
      'City',
      'Postcode',
      'Latitude',
      'Longitude',
      'Previous Land Use',
      'Land Conversion Year',
    ],
    ...Array(10).fill(null).map(() => Array(13).fill('') as string[]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 28 }, // Name
    { wch: 12 }, // Hectares
    { wch: 32 }, // Varieties
    { wch: 16 }, // Certification
    { wch: 14 }, // Climate
    { wch: 18 }, // Yield
    { wch: 18 }, // Country
    { wch: 16 }, // City
    { wch: 14 }, // Postcode
    { wch: 12 }, // Lat
    { wch: 12 }, // Lng
    { wch: 20 }, // Previous land use
    { wch: 20 }, // Conversion year
  ];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 12 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 12 } },
  ];
  return ws;
}

// ── Growing Profiles sheet ──────────────────────────────────────────────────

function buildGrowingProfilesSheet(): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    ['GROWING PROFILES — Add one row per vineyard per vintage year'],
    ['Link each profile to a vineyard using the Vineyard Name from the Vineyards sheet. Provide data for each vintage year.'],
    [''],
    [
      'Vineyard Name *',
      'Vintage Year *',
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
      'Grape Yield (tonnes) *',
      'Soil Carbon Override (kg CO2e/ha)',
      'Soil Carbon Lab Date',
      'Soil Carbon Lab Name',
      'Soil Carbon Sampling Points',
    ],
    ...Array(10).fill(null).map(() => Array(24).fill('') as string[]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 28 }, // Vineyard name
    { wch: 14 }, // Vintage year
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
    { wch: 28 }, // Soil carbon override
    { wch: 20 }, // Lab date
    { wch: 22 }, // Lab name
    { wch: 22 }, // Sampling points
  ];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 23 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 23 } },
  ];
  return ws;
}

// ── Example sheet ───────────────────────────────────────────────────────────

function buildExampleSheet(): XLSX.WorkSheet {
  const rows: (string | number | null)[][] = [
    ['EXAMPLE — Burgundy Pinot Noir Vineyard'],
    ['This shows a complete vineyard entry for a Burgundy wine producer. Use as a guide when filling in your own data.'],
    ['Delete or ignore this sheet when you upload. It will not be imported.'],
    [''],
    [''],
    ['VINEYARD'],
    ['Vineyard Name', 'Hectares', 'Grape Varieties', 'Certification', 'Climate Zone',
     'Annual Yield (tonnes)', 'Country', 'City'],
    ['Clos de la Roche', 4.5, 'Pinot Noir', 'organic', 'temperate',
     27, 'France', 'Morey-Saint-Denis'],
    [''],
    [''],
    ['GROWING PROFILE (Vintage 2024)'],
    ['Field', 'Value', '', 'Notes'],
    ['Vineyard Name', 'Clos de la Roche'],
    ['Vintage Year', 2024],
    ['Area (ha)', 4.5],
    ['Soil Management', 'cover_cropping', '', 'Inter-row grass cover maintained year-round'],
    ['Fertiliser Type', 'organic_compost', '', 'Composted grape marc and cover crop residues'],
    ['Fertiliser Qty (kg)', 2250, '', '500 kg/ha across 4.5 ha'],
    ['Fertiliser N%', 1.2, '', '1.2% nitrogen content in compost'],
    ['Pruning Residue Returned?', 'yes', '', 'Vine prunings mulched and returned to soil'],
    ['Uses Pesticides?', 'yes'],
    ['Pesticide Apps/yr', 6, '', '6 applications of copper + sulfur per season'],
    ['Pesticide Type', 'copper_fungicide', '', 'Copper-based (Bordeaux mixture), organic-approved'],
    ['Uses Herbicides?', 'no', '', 'Organic certification, mechanical weeding only'],
    ['Diesel (L/yr)', 350, '', 'Tractor operations: spraying, mowing, mechanical weeding'],
    ['Petrol (L/yr)', 20, '', 'Strimmer and hand tools'],
    ['Irrigated?', 'no', '', 'Burgundy: rainfed, irrigation not permitted for AOC wines'],
    ['Grape Yield (tonnes)', 27, '', '27 tonnes (6 t/ha, typical Burgundy AOC yield)'],
    [''],
    [''],
    ['GROWING PROFILE (Vintage 2023)'],
    ['Field', 'Value', '', 'Notes'],
    ['Vineyard Name', 'Clos de la Roche'],
    ['Vintage Year', 2023],
    ['Area (ha)', 4.5],
    ['Soil Management', 'cover_cropping'],
    ['Fertiliser Type', 'organic_compost'],
    ['Fertiliser Qty (kg)', 2250],
    ['Fertiliser N%', 1.2],
    ['Pruning Residue Returned?', 'yes'],
    ['Uses Pesticides?', 'yes'],
    ['Pesticide Apps/yr', 8, '', 'Wet 2023 season required more fungicide applications'],
    ['Pesticide Type', 'copper_fungicide'],
    ['Uses Herbicides?', 'no'],
    ['Diesel (L/yr)', 400, '', 'Slightly higher due to extra spray passes'],
    ['Petrol (L/yr)', 20],
    ['Irrigated?', 'no'],
    ['Grape Yield (tonnes)', 22, '', 'Lower yield due to mildew pressure'],
    [''],
    [''],
    ['WHY MULTIPLE VINTAGES?'],
    ['', 'Providing data for multiple vintages (ideally 3+) gives a more representative footprint.'],
    ['', 'alkatera uses median averaging to smooth out seasonal variability (weather, pest pressure, yield).'],
    ['', 'This follows GHG Protocol Product Standard guidance on multi-year averaging.'],
    [''],
    [''],
    ['EXPECTED IMPACT SUMMARY (single vintage 2024)'],
    ['', 'This vineyard would produce approximately:'],
    ['', 'FLAG emissions: ~45 kg CO2e (N2O from fertiliser and crop residue)'],
    ['', 'Non-FLAG emissions: ~1,100 kg CO2e (fuel, fertiliser production, pesticide)'],
    ['', 'Soil carbon removals: ~2,250 kg CO2e (cover cropping at 500 kg/ha/yr)'],
    ['', 'Per kg grapes: ~0.04 kg CO2e/kg'],
    ['', 'Per bottle (0.75L): ~0.06 kg CO2e (at 1.3 kg grapes per bottle)'],
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
    ['Use this sheet as a lookup when filling in the Vineyards and Growing Profiles sheets.'],
    [''],
    [''],
    ['CERTIFICATION'],
    ['Certification', 'Description'],
    ['conventional', 'Standard/conventional farming'],
    ['organic', 'Certified organic (EU, USDA, or equivalent)'],
    ['biodynamic', 'Biodynamic certification (Demeter or equivalent)'],
    ['leaf', 'LEAF (Linking Environment And Farming) certification'],
    [''],
    [''],
    ['CLIMATE ZONE'],
    ['Zone', 'Description', 'IPCC N2O EF1'],
    ['wet', 'Wet/tropical climate (high rainfall)', '0.016'],
    ['dry', 'Dry/arid climate (Mediterranean, inland Australia)', '0.005'],
    ['temperate', 'Temperate climate (most of UK, France, Germany, NZ)', '0.01'],
    [''],
    [''],
    ['SOIL MANAGEMENT'],
    ['Practice', 'Description', 'Soil Carbon Removal (kg CO2e/ha/yr)'],
    ['conventional_tillage', 'Regular tillage between rows', '0'],
    ['minimum_tillage', 'Reduced tillage, shallow cultivation only', '150'],
    ['no_till', 'No mechanical soil disturbance', '350'],
    ['cover_cropping', 'Permanent cover crops between rows', '500'],
    ['composting', 'Regular compost/organic matter additions', '300'],
    ['biochar_compost', 'Biochar-compost amendment', '700'],
    ['regenerative_integrated', 'Integrated regenerative (cover crops + min till + compost)', '600'],
    [''],
    [''],
    ['FERTILISER TYPE'],
    ['Type', 'Description'],
    ['none', 'No fertiliser applied'],
    ['synthetic_n', 'Synthetic nitrogen fertiliser (e.g. ammonium nitrate, urea)'],
    ['organic_manure', 'Animal manure'],
    ['organic_compost', 'Compost (including grape marc/pomace compost)'],
    ['mixed', 'Combination of synthetic and organic'],
    [''],
    [''],
    ['PESTICIDE / HERBICIDE TYPE'],
    ['Type', 'Description'],
    ['generic', 'Generic/unspecified pesticide'],
    ['copper_fungicide', 'Copper-based fungicide (Bordeaux mixture) — high ecotoxicity'],
    ['sulfur', 'Elemental sulfur (low toxicity, organic-approved)'],
    ['synthetic_fungicide', 'Other synthetic fungicide'],
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
    ['PREVIOUS LAND USE (for dLUC calculation)'],
    ['Land Use', 'Description'],
    ['permanent_vineyard', 'Already a vineyard (no land use change, zero dLUC)'],
    ['grassland', 'Previously grassland/pasture'],
    ['forest', 'Previously forest/woodland'],
    ['arable', 'Previously arable cropland'],
    ['wetland', 'Previously wetland'],
    ['settlement', 'Previously built-up/settlement'],
    ['other_land', 'Other land use'],
    [''],
    [''],
    ['SOIL CARBON OVERRIDE (optional)'],
    ['', 'If you have lab-measured soil carbon data, you can include it in the Growing Profiles sheet.'],
    ['', 'This overrides the default practice-based estimates above.'],
    ['', 'Enter the value in kg CO2e per hectare per year.'],
    ['', 'Include the lab name, measurement date, and number of sampling points for data quality scoring.'],
    ['', 'Verified lab data receives a higher confidence score in the LCA report.'],
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
 * Generate and download the vineyard data collection template as an XLSX file.
 *
 * Sheets:
 * 1. Instructions - how to use the template
 * 2. Vineyards - one row per vineyard
 * 3. Growing Profiles - one row per vineyard per vintage year
 * 4. Example - worked Burgundy Pinot Noir vineyard with 2 vintages
 * 5. Field Reference - all allowed values
 */
export function downloadViticultureTemplateAsXLSX(): void {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, buildInstructionsSheet(), 'Instructions');
  XLSX.utils.book_append_sheet(wb, buildVineyardsSheet(), 'Vineyards');
  XLSX.utils.book_append_sheet(wb, buildGrowingProfilesSheet(), 'Growing Profiles');
  XLSX.utils.book_append_sheet(wb, buildExampleSheet(), 'Example');
  XLSX.utils.book_append_sheet(wb, buildReferenceSheet(), 'Field Reference');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'alkatera-vineyard-data-template.xlsx';
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
