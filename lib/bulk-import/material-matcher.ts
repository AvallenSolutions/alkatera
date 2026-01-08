export function getConfidenceLevel(confidence: number | null): { level: string; label: string; color: string } {
  if (confidence === null || confidence === 0) {
    return { level: 'none', label: 'No Match', color: 'gray' };
  }
  if (confidence >= 0.8) {
    return { level: 'high', label: 'High Confidence', color: 'green' };
  }
  if (confidence >= 0.5) {
    return { level: 'medium', label: 'Medium Confidence', color: 'yellow' };
  }
  return { level: 'low', label: 'Low Confidence', color: 'red' };
}

export function matchMaterial(name: string): { materialId: string | null; confidence: number } {
  return { materialId: null, confidence: 0 };
}
