import { ConfidenceLevel } from './types';

export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.9) {
    return {
      level: 'high',
      label: 'High',
      color: 'text-green-600',
    };
  }

  if (confidence >= 0.7) {
    return {
      level: 'medium',
      label: 'Medium',
      color: 'text-amber-600',
    };
  }

  if (confidence >= 0.4) {
    return {
      level: 'low',
      label: 'Low',
      color: 'text-orange-600',
    };
  }

  return {
    level: 'none',
    label: 'No Match',
    color: 'text-gray-600',
  };
}

export function calculateMatchConfidence(
  searchTerm: string,
  materialName: string
): number {
  const search = searchTerm.toLowerCase().trim();
  const material = materialName.toLowerCase().trim();

  if (search === material) {
    return 1.0;
  }

  if (material.includes(search) || search.includes(material)) {
    return 0.85;
  }

  const searchWords = search.split(/\s+/);
  const materialWords = material.split(/\s+/);
  const matchingWords = searchWords.filter(word =>
    materialWords.some(mWord => mWord.includes(word) || word.includes(mWord))
  );

  if (matchingWords.length > 0) {
    return 0.6 * (matchingWords.length / searchWords.length);
  }

  return 0;
}
