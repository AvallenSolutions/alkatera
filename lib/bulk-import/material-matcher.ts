export interface MatchResult {
  matchedId: string | null;
  matchedName: string | null;
  confidence: number;
  suggestions: Array<{
    id: string;
    name: string;
    confidence: number;
  }>;
}

const COMMON_SUBSTITUTIONS: Record<string, string[]> = {
  'alcohol': ['ethanol', 'ethyl alcohol', 'spirits'],
  'sugar': ['sucrose', 'cane sugar', 'beet sugar', 'dextrose', 'fructose'],
  'salt': ['sodium chloride', 'sea salt', 'table salt'],
  'water': ['distilled water', 'filtered water', 'deionised water', 'h2o'],
  'corn': ['maize', 'corn grain'],
  'malt': ['malted barley', 'malted grain', 'malt extract'],
  'hops': ['hop pellets', 'hop extract'],
  'yeast': ['saccharomyces', 'brewer\'s yeast', 'baker\'s yeast'],
  'caramel': ['caramel colour', 'e150d'],
  'citric acid': ['citrate'],
  'potassium sorbate': ['sorbate'],
  'sodium benzoate': ['benzoate'],
  'sulfite': ['sulphite', 'so2'],
  'ascorbic acid': ['vitamin c'],
  'glycerin': ['glycerol'],
};

function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = Array(len2 + 1)
    .fill(null)
    .map(() => Array(len1 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;

  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }

  return matrix[len2][len1];
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1.0;

  const distance = levenshteinDistance(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  const similarity = 1 - distance / maxLen;

  return Math.max(0, similarity);
}

function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .split(' ')
    .sort()
    .join(' ');
}

function findSubstitutionSynonyms(name: string): string[] {
  const normalized = normalizeForMatching(name);
  const synonyms: string[] = [];

  for (const [key, values] of Object.entries(COMMON_SUBSTITUTIONS)) {
    const keyNorm = normalizeForMatching(key);
    if (normalized.includes(keyNorm)) {
      synonyms.push(...values);
      break;
    }

    for (const value of values) {
      const valueNorm = normalizeForMatching(value);
      if (normalized === valueNorm || normalized.includes(valueNorm)) {
        synonyms.push(key, ...values);
        break;
      }
    }
  }

  const unique = Array.from(new Set(synonyms));
  return unique;
}

export function matchMaterial(
  cleanName: string,
  existingMaterials: Array<{ id: string; name: string }>
): MatchResult {
  if (!cleanName || cleanName.length < 2) {
    return {
      matchedId: null,
      matchedName: null,
      confidence: 0,
      suggestions: []
    };
  }

  const normalizedClean = normalizeForMatching(cleanName);
  const synonyms = findSubstitutionSynonyms(cleanName);

  const scores: Array<{
    id: string;
    name: string;
    confidence: number;
  }> = [];

  for (const material of existingMaterials) {
    const normalizedMaterial = normalizeForMatching(material.name);

    let confidence = calculateSimilarity(normalizedClean, normalizedMaterial);

    if (normalizedClean === normalizedMaterial) {
      confidence = 1.0;
    } else if (normalizedClean.includes(normalizedMaterial) ||
               normalizedMaterial.includes(normalizedClean)) {
      confidence = Math.max(confidence, 0.85);
    }

    for (const syn of synonyms) {
      const synNorm = normalizeForMatching(syn);
      const synSimilarity = calculateSimilarity(synNorm, normalizedMaterial);
      if (synSimilarity > 0.7) {
        confidence = Math.max(confidence, synSimilarity * 0.9);
      }
    }

    if (confidence > 0.5) {
      scores.push({
        id: material.id,
        name: material.name,
        confidence: Math.round(confidence * 100) / 100
      });
    }
  }

  scores.sort((a, b) => b.confidence - a.confidence);

  const topMatch = scores[0];
  const suggestions = scores.slice(0, 3);

  return {
    matchedId: topMatch?.confidence > 0.7 ? topMatch.id : null,
    matchedName: topMatch?.confidence > 0.7 ? topMatch.name : null,
    confidence: topMatch?.confidence ?? 0,
    suggestions
  };
}

export function batchMatchMaterials(
  cleanNames: string[],
  existingMaterials: Array<{ id: string; name: string }>
): Map<string, MatchResult> {
  const results = new Map<string, MatchResult>();

  for (const name of cleanNames) {
    results.set(name, matchMaterial(name, existingMaterials));
  }

  return results;
}

export function scoreDataCompleteness(data: Record<string, any>): {
  percentage: number;
  missing: string[];
  optional: string[];
} {
  const required = ['Product Name'];
  const optional = [
    'SKU', 'Category', 'Description', 'Unit Size (Value)', 'Unit Size (Unit)',
    'Ingredient Name 1', 'Ingredient Qty 1', 'Ingredient Unit 1',
    'Ingredient Name 2', 'Ingredient Qty 2', 'Ingredient Unit 2',
    'Ingredient Name 3', 'Ingredient Qty 3', 'Ingredient Unit 3',
    'Packaging Type', 'Packaging Material', 'Packaging Weight'
  ];

  const missing: string[] = [];
  const missingOptional: string[] = [];

  for (const field of required) {
    if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
      missing.push(field);
    }
  }

  for (const field of optional) {
    if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
      missingOptional.push(field);
    }
  }

  const completedOptional = optional.length - missingOptional.length;
  const optionalPercentage = optional.length > 0 ? (completedOptional / optional.length) * 100 : 0;

  const percentage = Math.round(optionalPercentage);

  return {
    percentage,
    missing,
    optional: missingOptional
  };
}

export function validateQuantity(value: string | number | null): {
  valid: boolean;
  normalized: number | null;
  error: string | null;
} {
  if (value === null || value === '' || value === undefined) {
    return { valid: true, normalized: null, error: null };
  }

  const numValue = typeof value === 'number' ? value : parseFloat(String(value));

  if (isNaN(numValue)) {
    return { valid: false, normalized: null, error: 'Not a valid number' };
  }

  if (numValue <= 0) {
    return { valid: false, normalized: null, error: 'Must be greater than zero' };
  }

  if (numValue > 1000000) {
    return { valid: false, normalized: null, error: 'Value seems too large' };
  }

  return { valid: true, normalized: numValue, error: null };
}

export function validateUnit(unit: string | null): boolean {
  if (!unit) return false;
  const validUnits = ['ml', 'L', 'g', 'kg', 'unit', 'm'];
  return validUnits.includes(unit.toLowerCase());
}

export function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' | 'none' {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.6) return 'medium';
  if (confidence > 0) return 'low';
  return 'none';
}
