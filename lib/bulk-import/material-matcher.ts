export interface ConfidenceLevel {
  name: 'high' | 'medium' | 'low' | 'none';
  label: string;
  color: string;
  minScore: number;
}

const confidenceLevels: ConfidenceLevel[] = [
  { name: 'high', label: 'High Confidence', color: 'green', minScore: 0.8 },
  { name: 'medium', label: 'Medium Confidence', color: 'amber', minScore: 0.5 },
  { name: 'low', label: 'Low Confidence', color: 'orange', minScore: 0.2 },
  { name: 'none', label: 'No Match', color: 'red', minScore: 0 },
];

export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.8) {
    return confidenceLevels[0];
  } else if (score >= 0.5) {
    return confidenceLevels[1];
  } else if (score >= 0.2) {
    return confidenceLevels[2];
  }
  return confidenceLevels[3];
}

export function getConfidenceColor(score: number): string {
  return getConfidenceLevel(score).color;
}

export interface MaterialMatch {
  materialId: string;
  materialName: string;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'category';
}

export async function findMaterialMatches(
  rawName: string,
  _itemType: 'ingredient' | 'packaging'
): Promise<MaterialMatch[]> {
  const cleanName = rawName.toLowerCase().trim();
  return [
    {
      materialId: 'placeholder-id',
      materialName: cleanName,
      confidence: 0.5,
      matchType: 'fuzzy',
    },
  ];
}
