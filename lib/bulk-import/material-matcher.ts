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

    if (stringSim > bestScore && stringSim > 0.3) {
      bestScore = stringSim;
      bestMatch = {
        materialId: material.id,
        materialName: materialName,
        confidence: stringSim,
        source: stringSim > 0.85 ? 'exact' : 'fuzzy',
      };
    }
  }

  return bestMatch;
}

export function findBestMatchWithSynonyms(
  inputName: string,
  materials: StagingMaterial[],
  itemType: 'ingredient' | 'packaging'
): MatchResult | null {
  return matchMaterial(inputName, materials, itemType);
}
