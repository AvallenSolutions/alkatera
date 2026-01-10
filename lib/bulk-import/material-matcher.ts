export type ConfidenceLevelString = 'high' | 'medium' | 'low' | 'none';

export interface ConfidenceLevel {
  level: ConfidenceLevelString;
  label: string;
  color: string;
  badgeClass: string;
}

export interface MaterialMatch {
  id: string;
  name: string;
  confidence: number;
  emissionFactor?: number;
  unit?: string;
  source?: string;
}

export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.8) {
    return {
      level: 'high',
      label: 'High Confidence',
      color: 'green',
      badgeClass: 'bg-green-100 text-green-800 border-green-200',
    };
  }
  if (score >= 0.5) {
    return {
      level: 'medium',
      label: 'Medium Confidence',
      color: 'amber',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    };
  }
  if (score >= 0.3) {
    return {
      level: 'low',
      label: 'Low Confidence',
      color: 'orange',
      badgeClass: 'bg-orange-100 text-orange-800 border-orange-200',
    };
  }
  return {
    level: 'none',
    label: 'No Match',
    color: 'red',
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
  };
}

export async function findMaterialMatches(
  searchTerm: string,
  _limit: number = 5
): Promise<MaterialMatch[]> {
  return [
    {
      id: '1',
      name: searchTerm,
      confidence: 0.85,
      emissionFactor: 1.2,
      unit: 'kg CO2e/kg',
      source: 'DEFRA 2025',
    },
  ];
}
