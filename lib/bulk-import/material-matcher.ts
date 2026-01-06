/**
 * Material matching utilities for bulk import
 */

export function getConfidenceLevel(confidence: number): string {
  if (confidence >= 0.9) return 'High';
  if (confidence >= 0.7) return 'Medium';
  if (confidence >= 0.5) return 'Low';
  return 'Very Low';
}

export function matchMaterial(materialName: string, availableMaterials: string[]): {
  matchedMaterial: string | null;
  confidence: number;
} {
  // Simple exact match for now
  const normalizedInput = materialName.toLowerCase().trim();

  for (const material of availableMaterials) {
    const normalizedMaterial = material.toLowerCase().trim();
    if (normalizedInput === normalizedMaterial) {
      return { matchedMaterial: material, confidence: 1.0 };
    }
  }

  // Partial match
  for (const material of availableMaterials) {
    const normalizedMaterial = material.toLowerCase().trim();
    if (normalizedInput.includes(normalizedMaterial) || normalizedMaterial.includes(normalizedInput)) {
      return { matchedMaterial: material, confidence: 0.7 };
    }
  }

  return { matchedMaterial: null, confidence: 0 };
}
