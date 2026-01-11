export interface MatchResult {
  materialId: string | null;
  confidence: number;
  label: string;
}

export function getConfidenceLevel(confidence: number): { label: string; color: string } {
  if (confidence >= 0.9) {
    return { label: 'high', color: 'green' };
  } else if (confidence >= 0.7) {
    return { label: 'medium', color: 'amber' };
  } else if (confidence >= 0.5) {
    return { label: 'low', color: 'orange' };
  } else {
    return { label: 'no match', color: 'red' };
  }
}

export function matchMaterial(materialName: string, existingMaterials: any[]): MatchResult {
  const normalizedName = materialName.toLowerCase().trim();

  for (const material of existingMaterials) {
    const normalizedMaterialName = material.name.toLowerCase().trim();

    if (normalizedMaterialName === normalizedName) {
      return {
        materialId: material.id,
        confidence: 1.0,
        label: 'exact'
      };
    }

    if (normalizedMaterialName.includes(normalizedName) || normalizedName.includes(normalizedMaterialName)) {
      return {
        materialId: material.id,
        confidence: 0.8,
        label: 'partial'
      };
    }
  }

  return {
    materialId: null,
    confidence: 0,
    label: 'no match'
  };
}
