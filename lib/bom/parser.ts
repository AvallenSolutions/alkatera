import type { ExtractedBOMItem, BOMParseResult } from './types';

const PACKAGING_KEYWORDS = [
  'bottle', 'glass', 'label', 'cap', 'caps', 'closure', 'capsule', 'cork',
  'box', 'carton', 'cardboard', 'divider', 'tape', 'wrapper', 'shrink',
  'sleeve', 'pouch', 'can', 'jar', 'container', 'lid', 'seal', 'foil',
  'film', 'bag', 'case', 'crate', 'pallet', 'tray', 'insert'
];

const UNIT_MAPPING: Record<string, string> = {
  'kg': 'kg',
  'KG': 'kg',
  'g': 'g',
  'G': 'g',
  'l': 'L',
  'L': 'L',
  'ml': 'ml',
  'ML': 'ml',
  'mL': 'ml',
  'm': 'm',
  'M': 'm',
  'ea': 'unit',
  'EA': 'unit',
  'each': 'unit',
  'unit': 'unit',
  'units': 'unit',
  'pc': 'unit',
  'pcs': 'unit',
};

export function cleanMaterialName(rawName: string): string {
  let cleaned = rawName;

  const codePatterns = [
    /^\[[\w\s\-\.]+\]\s*/,
    /^\s*-\s*\[[\w\s\-\.]+\]\s*/,
    /\[[\w\s\-\.]+\]\s*/g,
  ];

  for (const pattern of codePatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  cleaned = cleaned
    .replace(/^\s*-\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned;
}

export function detectItemType(name: string): 'ingredient' | 'packaging' {
  const nameLower = name.toLowerCase();

  for (const keyword of PACKAGING_KEYWORDS) {
    if (nameLower.includes(keyword)) {
      return 'packaging';
    }
  }

  return 'ingredient';
}

export function normalizeUnit(unit: string | null): string | null {
  if (!unit) return null;

  const trimmed = unit.trim();
  return UNIT_MAPPING[trimmed] || trimmed.toLowerCase();
}

export function parseQuantity(value: string | null): number | null {
  if (!value) return null;

  const cleaned = value.replace(/,/g, '').trim();
  const num = parseFloat(cleaned);

  return isNaN(num) ? null : num;
}

export function parseBOMText(text: string): BOMParseResult {
  const result: BOMParseResult = {
    success: false,
    items: [],
    errors: [],
    metadata: {},
  };

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  for (const line of lines) {
    const productCodeMatch = line.match(/Product Code:\s*(.+?)(?:\s+Created|$)/i);
    if (productCodeMatch) {
      result.metadata.productCode = productCodeMatch[1].trim();
    }

    const productDescMatch = line.match(/Product Description:\s*(.+?)(?:\s+Created|$)/i);
    if (productDescMatch) {
      result.metadata.productDescription = productDescMatch[1].trim();
    }

    const totalValueMatch = line.match(/Total Value:\s*([\d.,]+)/i);
    if (totalValueMatch) {
      result.metadata.totalValue = parseQuantity(totalValueMatch[1]) ?? undefined;
    }

    const createdDateMatch = line.match(/Created Date:\s*([\d\/]+)/i);
    if (createdDateMatch) {
      result.metadata.createdDate = createdDateMatch[1].trim();
    }
  }

  const componentPatterns = [
    /^(?:\s*-\s*)?\[([^\]]+)\]\s*(.+?)(?:\s+(KG|G|L|ML|M|EA|unit|units|pc|pcs))\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)$/i,
    /^(.+?)\s+(KG|G|L|ML|M|EA|unit|units|pc|pcs)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)$/i,
  ];

  const extractedItems: ExtractedBOMItem[] = [];

  for (const line of lines) {
    if (line.includes('Component Product') || line.includes('Units') ||
        line.includes('Wastage') || line.includes('Unit Cost')) {
      continue;
    }

    const componentMatch = extractComponentFromLine(line);
    if (componentMatch) {
      extractedItems.push(componentMatch);
    }
  }

  result.items = extractedItems;
  result.success = extractedItems.length > 0;

  if (extractedItems.length === 0) {
    result.errors.push('No components could be extracted from the BOM');
  }

  return result;
}

function extractComponentFromLine(line: string): ExtractedBOMItem | null {
  const patterns = [
    {
      regex: /^(.+?)\s+(?:(KG|G|L|ML|M|EA|unit|each)\s+)?([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)$/i,
      groups: { name: 1, unit: 2, quantity: 3, wastage: 4, unitCost: 5, totalCost: 6 }
    },
    {
      regex: /^(.+?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)$/i,
      groups: { name: 1, quantity: 2, wastage: 3, unitCost: 4, totalCost: 5 }
    },
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern.regex);
    if (match) {
      const rawName = match[pattern.groups.name]?.trim() || '';

      if (rawName.length < 3 || rawName.includes('Page ') ||
          rawName.toLowerCase().includes('total') ||
          rawName.toLowerCase().includes('component product')) {
        continue;
      }

      const cleanName = cleanMaterialName(rawName);
      const unit = pattern.groups.unit ? match[pattern.groups.unit] : null;
      const quantity = parseQuantity(match[pattern.groups.quantity]);
      const unitCost = parseQuantity(match[pattern.groups.unitCost]);
      const totalCost = parseQuantity(match[pattern.groups.totalCost]);

      return {
        rawName,
        cleanName,
        quantity,
        unit: normalizeUnit(unit),
        itemType: detectItemType(cleanName),
        unitCost,
        totalCost,
      };
    }
  }

  return null;
}

export function parseCSV(content: string, delimiter: string = ','): BOMParseResult {
  const result: BOMParseResult = {
    success: false,
    items: [],
    errors: [],
    metadata: {},
  };

  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (lines.length < 2) {
    result.errors.push('CSV file must have at least a header row and one data row');
    return result;
  }

  const headerRow = lines[0];
  const headers = parseCSVLine(headerRow, delimiter).map(h => h.toLowerCase().trim());

  const columnMap = detectColumnMapping(headers);

  if (!columnMap.name) {
    result.errors.push('Could not identify a name/description column in the CSV');
    return result;
  }

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter);

    if (values.length === 0) continue;

    const rawName = columnMap.name !== null ? values[columnMap.name] || '' : '';

    if (!rawName || rawName.length < 2) continue;

    const cleanName = cleanMaterialName(rawName);
    const quantity = columnMap.quantity !== null ? parseQuantity(values[columnMap.quantity]) : null;
    const unit = columnMap.unit !== null ? normalizeUnit(values[columnMap.unit]) : null;
    const unitCost = columnMap.unitCost !== null ? parseQuantity(values[columnMap.unitCost]) : null;
    const totalCost = columnMap.totalCost !== null ? parseQuantity(values[columnMap.totalCost]) : null;

    result.items.push({
      rawName,
      cleanName,
      quantity,
      unit,
      itemType: detectItemType(cleanName),
      unitCost,
      totalCost,
    });
  }

  result.success = result.items.length > 0;

  if (result.items.length === 0) {
    result.errors.push('No valid items could be extracted from the CSV');
  }

  return result;
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());

  return result;
}

interface ColumnMapping {
  name: number | null;
  quantity: number | null;
  unit: number | null;
  unitCost: number | null;
  totalCost: number | null;
}

function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    name: null,
    quantity: null,
    unit: null,
    unitCost: null,
    totalCost: null,
  };

  const namePatterns = ['name', 'description', 'component', 'product', 'material', 'item'];
  const quantityPatterns = ['quantity', 'qty', 'amount', 'vol', 'weight'];
  const unitPatterns = ['unit', 'units', 'uom'];
  const unitCostPatterns = ['unit cost', 'unit_cost', 'unitcost', 'price'];
  const totalCostPatterns = ['total cost', 'total_cost', 'totalcost', 'total', 'cost'];

  headers.forEach((header, index) => {
    const h = header.toLowerCase();

    if (!mapping.name && namePatterns.some(p => h.includes(p))) {
      mapping.name = index;
    }
    if (!mapping.quantity && quantityPatterns.some(p => h.includes(p))) {
      mapping.quantity = index;
    }
    if (!mapping.unit && unitPatterns.some(p => h === p || h.startsWith(p + ' '))) {
      mapping.unit = index;
    }
    if (!mapping.unitCost && unitCostPatterns.some(p => h.includes(p))) {
      mapping.unitCost = index;
    }
    if (!mapping.totalCost && totalCostPatterns.some(p => h.includes(p))) {
      if (!unitCostPatterns.some(p => h.includes(p))) {
        mapping.totalCost = index;
      }
    }
  });

  if (mapping.name === null && headers.length > 0) {
    mapping.name = 0;
  }

  return mapping;
}

export function parseBOMFromPDFText(pdfText: string): BOMParseResult {
  const result: BOMParseResult & { _rawTextSample?: string } = {
    success: false,
    items: [],
    errors: [],
    metadata: {},
  };

  // Store sample of raw text for debugging
  result._rawTextSample = pdfText.substring(0, 1500);

  const lines = pdfText.split('\n').map(l => l.trim());

  for (const line of lines) {
    const productCodeMatch = line.match(/Product Code:\s*(.+?)(?:\s+Created|$)/i);
    if (productCodeMatch) {
      result.metadata.productCode = productCodeMatch[1].trim();
    }

    const productDescMatch = line.match(/Product Description:\s*(.+?)(?:\s+Created|$)/i);
    if (productDescMatch) {
      result.metadata.productDescription = productDescMatch[1].trim();
    }

    const createdDateMatch = line.match(/Created Date:\s*([\d\/]+)/i);
    if (createdDateMatch) {
      result.metadata.createdDate = createdDateMatch[1].trim();
    }
  }

  // Try to parse as tabular data first (handles PDF tables better)
  const tabularItems = parseTabularPDFText(pdfText);
  if (tabularItems.length > 0) {
    result.items = tabularItems;
    result.success = true;
    return result;
  }

  // Fallback: component block pattern for coded BOMs
  const componentBlockPattern = /\[([^\]]+)\]\s*([^\[]+?)(?=\[|$)/g;
  let match;

  while ((match = componentBlockPattern.exec(pdfText)) !== null) {
    const code = match[1].trim();
    const rest = match[2].trim();

    const fullRawName = `[${code}] ${rest.split(/\s+(?:KG|G|L|ML|M|EA|unit)/i)[0]}`.trim();
    const cleanName = cleanMaterialName(fullRawName);

    const numbersMatch = rest.match(/([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/);
    const unitMatch = rest.match(/\b(KG|G|L|ML|M|EA|unit|units)\b/i);

    if (cleanName.length > 2 && !cleanName.toLowerCase().includes('page')) {
      result.items.push({
        rawName: fullRawName,
        cleanName,
        quantity: numbersMatch ? parseQuantity(numbersMatch[1]) : null,
        unit: unitMatch ? normalizeUnit(unitMatch[1]) : null,
        itemType: detectItemType(cleanName),
        unitCost: numbersMatch ? parseQuantity(numbersMatch[3]) : null,
        totalCost: numbersMatch ? parseQuantity(numbersMatch[4]) : null,
      });
    }
  }

  // Fallback: line by line extraction
  const lineByLineItems = extractItemsLineByLine(lines);
  if (lineByLineItems.length > result.items.length) {
    result.items = lineByLineItems;
  }

  const uniqueItems = deduplicateItems(result.items);
  result.items = uniqueItems;
  result.success = uniqueItems.length > 0;

  if (uniqueItems.length === 0) {
    result.errors.push('Could not extract any components from the PDF. The format may not be supported.');
  }

  return result;
}

/**
 * Parse PDF text that was extracted from a tabular format.
 * PDF text extraction often joins columns with spaces, so we need to
 * identify patterns like: "Name Unit Quantity WastageQty UnitCost TotalCost"
 */
function parseTabularPDFText(pdfText: string): ExtractedBOMItem[] {
  const items: ExtractedBOMItem[] = [];

  // Split into lines and normalize whitespace
  const lines = pdfText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Skip header lines
  const skipPatterns = [
    /component\s*product/i,
    /^units?\s*$/i,
    /wastage/i,
    /unit\s*cost/i,
    /total\s*cost/i,
    /^page\s*\d/i,
    /www\./i,
  ];

  for (const line of lines) {
    // Skip header/footer lines
    if (skipPatterns.some(p => p.test(line))) {
      continue;
    }

    // Pattern 1: [Code] Name followed by Unit and numbers
    // Example: "[500L Three Spirit - Nightcap] 500L Three Spirit - Nightcap L 0.0010 0.0000 1,257.9282 1.26"
    const pattern1 = /^(.+?)\s+(L|KG|G|ML|M|EA|unit|units|pc|pcs|each)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s*$/i;
    const match1 = line.match(pattern1);

    if (match1) {
      const rawName = match1[1].trim();
      const cleanName = cleanMaterialName(rawName);
      const unit = match1[2];
      const quantity = parseQuantity(match1[3]);
      const wastage = parseQuantity(match1[4]);
      const unitCost = parseQuantity(match1[5]);
      const totalCost = parseQuantity(match1[6]);

      if (cleanName.length > 2) {
        items.push({
          rawName,
          cleanName,
          quantity,
          unit: normalizeUnit(unit),
          itemType: detectItemType(cleanName),
          unitCost,
          totalCost,
        });
        continue;
      }
    }

    // Pattern 2: Name followed by numbers only (unit might be on separate line or missing)
    // Example: "Hop Extract Mosaic P21 0.0003 0.0000 333.2975 0.08"
    const pattern2 = /^(.+?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s*$/;
    const match2 = line.match(pattern2);

    if (match2) {
      const rawName = match2[1].trim();
      // Make sure rawName doesn't end with a unit that got captured
      const unitSuffixMatch = rawName.match(/\s+(L|KG|G|ML|M|EA|unit|units|pc|pcs|each)$/i);
      let cleanRawName = rawName;
      let detectedUnit: string | null = null;

      if (unitSuffixMatch) {
        cleanRawName = rawName.slice(0, -unitSuffixMatch[0].length).trim();
        detectedUnit = unitSuffixMatch[1];
      }

      const cleanName = cleanMaterialName(cleanRawName);
      const quantity = parseQuantity(match2[2]);
      const wastage = parseQuantity(match2[3]);
      const unitCost = parseQuantity(match2[4]);
      const totalCost = parseQuantity(match2[5]);

      // Filter out things that look like numbers or are too short
      if (cleanName.length > 2 && !/^[\d.,\s]+$/.test(cleanName)) {
        items.push({
          rawName: cleanRawName,
          cleanName,
          quantity,
          unit: detectedUnit ? normalizeUnit(detectedUnit) : 'kg', // Default to kg
          itemType: detectItemType(cleanName),
          unitCost,
          totalCost,
        });
        continue;
      }
    }

    // Pattern 3: Line with bracketed code at start
    // Example: "[BABS GVAL003] N04 Valerian Extract 0.0008 0.0000 75.3356 0.06"
    const pattern3 = /^\[([^\]]+)\]\s*(.+?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s*$/;
    const match3 = line.match(pattern3);

    if (match3) {
      const code = match3[1].trim();
      let namePart = match3[2].trim();

      // Check if unit is at the end of namePart
      const unitMatch = namePart.match(/\s+(L|KG|G|ML|M|EA|unit|units|pc|pcs|each)$/i);
      let unit: string | null = null;
      if (unitMatch) {
        unit = unitMatch[1];
        namePart = namePart.slice(0, -unitMatch[0].length).trim();
      }

      const rawName = `[${code}] ${namePart}`;
      const cleanName = cleanMaterialName(rawName);
      const quantity = parseQuantity(match3[3]);
      const unitCost = parseQuantity(match3[5]);
      const totalCost = parseQuantity(match3[6]);

      if (cleanName.length > 2) {
        items.push({
          rawName,
          cleanName,
          quantity,
          unit: unit ? normalizeUnit(unit) : 'kg',
          itemType: detectItemType(cleanName),
          unitCost,
          totalCost,
        });
      }
    }
  }

  return deduplicateItems(items);
}

function extractItemsLineByLine(lines: string[]): ExtractedBOMItem[] {
  const items: ExtractedBOMItem[] = [];
  let currentItem: Partial<ExtractedBOMItem> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('Component Product') || line.includes('Wastage Qty') ||
        line.includes('Page ') || line.includes('www.') ||
        line.toLowerCase().includes('total value')) {
      continue;
    }

    const bracketMatch = line.match(/^\s*-?\s*\[([^\]]+)\]\s*(.+)/);
    if (bracketMatch) {
      if (currentItem && currentItem.rawName) {
        items.push(currentItem as ExtractedBOMItem);
      }

      const rawName = `[${bracketMatch[1]}] ${bracketMatch[2]}`.trim();
      const cleanName = cleanMaterialName(rawName);

      currentItem = {
        rawName,
        cleanName,
        quantity: null,
        unit: null,
        itemType: detectItemType(cleanName),
        unitCost: null,
        totalCost: null,
      };

      const numbersInLine = bracketMatch[2].match(/([\d.,]+)/g);
      const unitInLine = bracketMatch[2].match(/\b(KG|G|L|ML|M|EA|unit|units)\b/i);

      if (unitInLine) {
        currentItem.unit = normalizeUnit(unitInLine[1]);
      }

      if (numbersInLine && numbersInLine.length >= 4) {
        currentItem.quantity = parseQuantity(numbersInLine[0]);
        currentItem.unitCost = parseQuantity(numbersInLine[2]);
        currentItem.totalCost = parseQuantity(numbersInLine[3]);
      }
    }

    const numbersOnlyMatch = line.match(/^(KG|G|L|ML|M|EA|unit|units)?\s*([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)$/i);
    if (numbersOnlyMatch && currentItem && !currentItem.quantity) {
      if (numbersOnlyMatch[1]) {
        currentItem.unit = normalizeUnit(numbersOnlyMatch[1]);
      }
      currentItem.quantity = parseQuantity(numbersOnlyMatch[2]);
      currentItem.unitCost = parseQuantity(numbersOnlyMatch[4]);
      currentItem.totalCost = parseQuantity(numbersOnlyMatch[5]);
    }
  }

  if (currentItem && currentItem.rawName) {
    items.push(currentItem as ExtractedBOMItem);
  }

  return items;
}

function deduplicateItems(items: ExtractedBOMItem[]): ExtractedBOMItem[] {
  const seen = new Set<string>();
  const unique: ExtractedBOMItem[] = [];

  for (const item of items) {
    const key = item.cleanName.toLowerCase();
    if (!seen.has(key) && item.cleanName.length > 2) {
      seen.add(key);
      unique.push(item);
    }
  }

  return unique;
}
