import type { MatchResult } from './types';

export function getConfidenceLevel(confidence: number): string {
  if (confidence >= 0.9) return 'excellent';
  if (confidence >= 0.75) return 'good';
  if (confidence >= 0.5) return 'fair';
  if (confidence >= 0.25) return 'low';
  return 'none';
}

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'text-green-700 bg-green-100';
  if (confidence >= 0.75) return 'text-blue-700 bg-blue-100';
  if (confidence >= 0.5) return 'text-amber-700 bg-amber-100';
  if (confidence >= 0.25) return 'text-orange-700 bg-orange-100';
  return 'text-red-700 bg-red-100';
}

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

function tokenize(str: string): string[] {
  return normalizeString(str).split(' ').filter(Boolean);
}

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function stringSimilarity(a: string, b: string): number {
  const normA = normalizeString(a);
  const normB = normalizeString(b);

  if (normA === normB) return 1;

  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1;

  const distance = levenshteinDistance(normA, normB);
  return 1 - distance / maxLen;
}

function tokenSimilarity(inputTokens: string[], targetTokens: string[]): number {
  if (inputTokens.length === 0 || targetTokens.length === 0) return 0;

  let matchedCount = 0;
  let totalScore = 0;

  for (const inputToken of inputTokens) {
    let bestMatch = 0;
    for (const targetToken of targetTokens) {
      const similarity = stringSimilarity(inputToken, targetToken);
      bestMatch = Math.max(bestMatch, similarity);
    }
    if (bestMatch > 0.7) {
      matchedCount++;
      totalScore += bestMatch;
    }
  }

  const coverage = matchedCount / inputTokens.length;
  const avgScore = matchedCount > 0 ? totalScore / matchedCount : 0;

  return coverage * avgScore;
}

export interface StagingMaterial {
  id: string;
  material_name: string;
  category?: string;
  ghg_factor?: number;
}

export function matchMaterial(
  inputName: string,
  materials: StagingMaterial[],
  itemType: 'ingredient' | 'packaging' = 'ingredient'
): MatchResult | null {
  if (!inputName || materials.length === 0) return null;

  const inputTokens = tokenize(inputName);
  let bestMatch: MatchResult | null = null;
  let bestScore = 0;

  for (const material of materials) {
    const materialName = material.material_name;
    const exactMatch = normalizeString(inputName) === normalizeString(materialName);

    if (exactMatch) {
      return {
        materialId: material.id,
        materialName: materialName,
        confidence: 1,
        source: 'exact',
      };
    }

    const stringSim = stringSimilarity(inputName, materialName);

    const materialTokens = tokenize(materialName);
    const tokenSim = tokenSimilarity(inputTokens, materialTokens);

    const score = Math.max(stringSim, tokenSim * 0.95);

    if (score > bestScore && score > 0.3) {
      bestScore = score;
      bestMatch = {
        materialId: material.id,
        materialName: materialName,
        confidence: score,
        source: score > 0.85 ? 'exact' : 'fuzzy',
      };
    }
  }

  return bestMatch;
}

export function matchMaterialsFromCSV(
  items: Array<{ name: string; type: 'ingredient' | 'packaging' }>,
  materials: StagingMaterial[]
): Map<string, MatchResult | null> {
  const results = new Map<string, MatchResult | null>();

  for (const item of items) {
    const match = matchMaterial(item.name, materials, item.type);
    results.set(item.name, match);
  }

  return results;
}

const INGREDIENT_SYNONYMS: Record<string, string[]> = {
  'juniper': ['juniper berries', 'juniper berry', 'juniperus'],
  'coriander': ['coriander seeds', 'coriander seed', 'cilantro seeds'],
  'angelica': ['angelica root', 'angelica'],
  'citrus': ['citrus peel', 'orange peel', 'lemon peel', 'lime peel'],
  'grain': ['wheat', 'barley', 'rye', 'corn', 'maize', 'malt'],
  'sugar': ['cane sugar', 'sucrose', 'glucose', 'fructose', 'molasses'],
  'water': ['purified water', 'spring water', 'mineral water', 'distilled water'],
  'yeast': ['brewer\'s yeast', 'wine yeast', 'distiller\'s yeast'],
  'hops': ['hop pellets', 'whole hops', 'hop extract'],
  'malt': ['malted barley', 'pale malt', 'crystal malt', 'roasted malt'],
};

const PACKAGING_SYNONYMS: Record<string, string[]> = {
  'glass': ['glass bottle', 'glass container', 'bottle glass'],
  'aluminium': ['aluminum', 'aluminium can', 'aluminum can', 'alu'],
  'steel': ['steel cap', 'crown cap', 'metal cap', 'tin'],
  'paper': ['paper label', 'paper sleeve', 'carton'],
  'cardboard': ['corrugated cardboard', 'cardboard box', 'carton'],
  'plastic': ['pet', 'hdpe', 'pp', 'ldpe', 'polypropylene', 'polyethylene'],
  'cork': ['natural cork', 'cork stopper', 'composite cork'],
};

export function expandSynonyms(name: string, type: 'ingredient' | 'packaging'): string[] {
  const synonyms = type === 'ingredient' ? INGREDIENT_SYNONYMS : PACKAGING_SYNONYMS;
  const normalizedName = normalizeString(name);
  const expanded: string[] = [name];

  for (const [key, values] of Object.entries(synonyms)) {
    if (normalizedName.includes(key)) {
      expanded.push(...values);
    }
    for (const value of values) {
      if (normalizeString(value).includes(normalizedName)) {
        expanded.push(key);
        break;
      }
    }
  }

  return Array.from(new Set(expanded));
}

export function findBestMatchWithSynonyms(
  inputName: string,
  materials: StagingMaterial[],
  itemType: 'ingredient' | 'packaging'
): MatchResult | null {
  const directMatch = matchMaterial(inputName, materials, itemType);

  if (directMatch && directMatch.confidence > 0.8) {
    return directMatch;
  }

  const synonyms = expandSynonyms(inputName, itemType);
  let bestMatch: MatchResult | null = directMatch;
  let bestConfidence = directMatch?.confidence ?? 0;

  for (const synonym of synonyms) {
    if (synonym === inputName) continue;

    const match = matchMaterial(synonym, materials, itemType);
    if (match && match.confidence > bestConfidence) {
      bestMatch = {
        ...match,
        confidence: match.confidence * 0.9,
      };
      bestConfidence = match.confidence;
    }
  }

  return bestMatch;
}
