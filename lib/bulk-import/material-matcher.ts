export function getConfidenceLevel(confidence: number): string {
  if (confidence >= 0.9) return 'high';
  if (confidence >= 0.7) return 'medium';
  if (confidence >= 0.5) return 'low';
  return 'none';
}

export function matchMaterialByName(name: string): { materialId: string | null; confidence: number } {
  return {
    materialId: null,
    confidence: 0
  };
}
