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
 * This handles the specific format where numbers are concatenated and
 * items can span multiple lines.
 */
function parseTabularPDFText(pdfText: string): ExtractedBOMItem[] {
  const items: ExtractedBOMItem[] = [];

  // Split into lines
  const lines = pdfText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Skip patterns for headers/footers
  const skipPatterns = [
    /^total\s*cost/i,
    /^unit\s*cost/i,
    /^wastage/i,
    /^quantity/i,
    /^units?$/i,
    /^component\s*product/i,
    /^page\s*\d/i,
    /www\./i,
    /^bom-\d+/i,
    /beyond alcohol/i,
    /acklam road/i,
    /^bill of materials$/i,
    /^london/i,
    /product code:/i,
    /product description:/i,
    /total value:/i,
    /^comments:?$/i,
    /created date:/i,
    /created by:/i,
  ];

  // Pattern: line starts with numbers, optionally ends with unit
  const numbersLinePattern = /^([\d.,]+)(L|KG|G|ML|M|EA)?$/i;

  // Pattern: numbers followed by unit and separator with code/name on same line
  const sameLinePattern = /^([\d.,]+)(L|KG|G|ML|M|EA)\s*-\s*\[([^\]]+)\]\s*(.*)$/i;

  // Pattern: numbers (no unit) followed by separator with code/name on same line
  const sameLineNoUnitPattern = /^([\d.,]+)\s+-\s+\[([^\]]+)\]\s*(.*)$/i;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Skip header/footer lines
    if (skipPatterns.some(p => p.test(line))) {
      i++;
      continue;
    }

    // Try same-line pattern with unit: "0.0675.33560.00000.0008KG  -  [BABS GVAL003] N04 Valerian Extract"
    const sameLineMatch = line.match(sameLinePattern);
    if (sameLineMatch) {
      const numbersStr = sameLineMatch[1];
      const unit = sameLineMatch[2];
      const code = sameLineMatch[3].trim();
      let name = sameLineMatch[4].trim();

      // Check if name continues on next lines
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j];
        // Stop if next line starts with numbers or is a header
        if (numbersLinePattern.test(nextLine) ||
            sameLinePattern.test(nextLine) ||
            sameLineNoUnitPattern.test(nextLine) ||
            skipPatterns.some(p => p.test(nextLine))) {
          break;
        }
        // Stop if next line looks like a new item continuation pattern
        if (/^\s*-\s*\[/.test(nextLine)) {
          break;
        }
        name += ' ' + nextLine;
        j++;
      }

      const numbers = parseConcatenatedNumbers(numbersStr);
      if (numbers) {
        const rawName = `[${code}] ${name}`;
        const cleanName = cleanMaterialName(rawName);

        items.push({
          rawName,
          cleanName,
          quantity: numbers.quantity,
          unit: normalizeUnit(unit),
          itemType: detectItemType(cleanName),
          unitCost: numbers.unitCost,
          totalCost: numbers.totalCost,
        });
      }
      i = j;
      continue;
    }

    // Try same-line pattern without unit: "0.08333.29750.00000.0003  -  [Hop Extract] Name"
    const sameLineNoUnitMatch = line.match(sameLineNoUnitPattern);
    if (sameLineNoUnitMatch) {
      const numbersStr = sameLineNoUnitMatch[1];
      const code = sameLineNoUnitMatch[2].trim();
      let name = sameLineNoUnitMatch[3].trim();

      // Check if name continues on next lines
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j];
        if (numbersLinePattern.test(nextLine) ||
            sameLinePattern.test(nextLine) ||
            sameLineNoUnitPattern.test(nextLine) ||
            skipPatterns.some(p => p.test(nextLine))) {
          break;
        }
        if (/^\s*-\s*\[/.test(nextLine)) {
          break;
        }
        name += ' ' + nextLine;
        j++;
      }

      const numbers = parseConcatenatedNumbers(numbersStr);
      if (numbers) {
        const rawName = `[${code}] ${name}`;
        const cleanName = cleanMaterialName(rawName);

        items.push({
          rawName,
          cleanName,
          quantity: numbers.quantity,
          unit: 'kg', // Default unit
          itemType: detectItemType(cleanName),
          unitCost: numbers.unitCost,
          totalCost: numbers.totalCost,
        });
      }
      i = j;
      continue;
    }

    // Try numbers-only line pattern (numbers on this line, name on next lines)
    const numbersOnlyMatch = line.match(numbersLinePattern);
    if (numbersOnlyMatch) {
      const numbersStr = numbersOnlyMatch[1];
      const unit = numbersOnlyMatch[2] || null;

      // Look at next line(s) for the item name
      let j = i + 1;
      let nameLines: string[] = [];

      while (j < lines.length) {
        const nextLine = lines[j];

        // Stop if we hit another numbers line or header
        if (numbersLinePattern.test(nextLine) ||
            sameLinePattern.test(nextLine) ||
            sameLineNoUnitPattern.test(nextLine) ||
            skipPatterns.some(p => p.test(nextLine))) {
          break;
        }

        nameLines.push(nextLine);
        j++;
      }

      if (nameLines.length > 0) {
        // Join all name lines
        const fullNameText = nameLines.join(' ').trim();

        // Try to extract code and name from the joined text
        // Pattern: "  -  [code] name" or "[code] name"
        const codeNameMatch = fullNameText.match(/^\s*-?\s*\[([^\]]+)\]\s*(.*)$/);

        if (codeNameMatch) {
          const code = codeNameMatch[1].trim();
          const name = codeNameMatch[2].trim();

          const numbers = parseConcatenatedNumbers(numbersStr);
          if (numbers) {
            const rawName = `[${code}] ${name}`;
            const cleanName = cleanMaterialName(rawName);

            items.push({
              rawName,
              cleanName,
              quantity: numbers.quantity,
              unit: unit ? normalizeUnit(unit) : 'kg',
              itemType: detectItemType(cleanName),
              unitCost: numbers.unitCost,
              totalCost: numbers.totalCost,
            });
          }
        }
      }
      i = j;
      continue;
    }

    // Move to next line if no pattern matched
    i++;
  }

  return deduplicateItems(items);
}

/**
 * Parse concatenated numbers from PDF extraction.
 * Numbers are in format: TotalCost + UnitCost + Wastage + Quantity
 * Example: "0.0675.33560.00000.0008" -> { totalCost: 0.06, unitCost: 75.3356, wastage: 0.0000, quantity: 0.0008 }
 */
function parseConcatenatedNumbers(str: string): { totalCost: number; unitCost: number; wastage: number; quantity: number } | null {
  // Remove any commas
  const cleaned = str.replace(/,/g, '');

  // Strategy: Find all decimal points and try to split intelligently
  // The numbers are concatenated, so we need to find boundaries
  // Pattern: each number typically has format X.XXXX or XX.XXXX etc.

  // Find all positions of decimal points
  const decimalPositions: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '.') {
      decimalPositions.push(i);
    }
  }

  // We expect 4 numbers, so we need 4 decimal points
  if (decimalPositions.length < 4) {
    return null;
  }

  // Try to extract 4 numbers by splitting at decimal boundaries
  // Each number ends where the next number's integer part begins
  // We'll work backwards since quantity is last and most important

  const numbers: number[] = [];

  // Split the string into potential numbers
  // Look for patterns like: digits + decimal + digits
  const numberPattern = /(\d+\.\d+)/g;
  const matches = cleaned.match(numberPattern);

  if (matches && matches.length >= 4) {
    // Take the last 4 numbers (totalCost, unitCost, wastage, quantity - but they're concatenated)
    // Actually the order in the PDF is: TotalCost, UnitCost, Wastage, Quantity (left to right visually)
    // But when extracted, they appear in that same order

    // We need exactly 4 numbers
    const relevantMatches = matches.slice(-4);
    if (relevantMatches.length === 4) {
      return {
        totalCost: parseFloat(relevantMatches[0]),
        unitCost: parseFloat(relevantMatches[1]),
        wastage: parseFloat(relevantMatches[2]),
        quantity: parseFloat(relevantMatches[3]),
      };
    }
  }

  // Fallback: try manual parsing
  // Pattern observed: numbers are touching, like "0.0675.33560.00000.0008"
  // This means: 0.06, 75.3356, 0.0000, 0.0008
  // The tricky part is 0.06 followed by 75.3356 looks like 0.0675.3356

  // Try splitting by looking for digit sequences after decimal
  // A new number starts when we see a pattern that would be invalid for a single number
  // i.e., a second decimal point

  try {
    let remaining = cleaned;
    const extractedNumbers: number[] = [];

    while (remaining.length > 0 && extractedNumbers.length < 4) {
      // Find the first decimal point
      const firstDot = remaining.indexOf('.');
      if (firstDot === -1) break;

      // Find the next decimal point after this one
      const secondDot = remaining.indexOf('.', firstDot + 1);

      if (secondDot === -1) {
        // No more decimals, take the rest as the last number
        extractedNumbers.push(parseFloat(remaining));
        break;
      }

      // The first number ends just before where the second number's integer part begins
      // Work backwards from secondDot to find where the integer part of the second number starts
      let splitPoint = secondDot;
      while (splitPoint > firstDot + 1 && remaining[splitPoint - 1] >= '0' && remaining[splitPoint - 1] <= '9') {
        splitPoint--;
      }

      const firstNum = remaining.substring(0, splitPoint);
      extractedNumbers.push(parseFloat(firstNum));
      remaining = remaining.substring(splitPoint);
    }

    if (extractedNumbers.length === 4) {
      return {
        totalCost: extractedNumbers[0],
        unitCost: extractedNumbers[1],
        wastage: extractedNumbers[2],
        quantity: extractedNumbers[3],
      };
    }
  } catch (e) {
    // Parsing failed
  }

  return null;
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
