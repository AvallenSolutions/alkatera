export function getConfidenceLevel(confidence: number): { level: 'high' | 'medium' | 'low'; label: string } {
  if (confidence >= 0.8) {
    return { level: 'high', label: 'high' };
  } else if (confidence >= 0.5) {
    return { level: 'medium', label: 'medium' };
  } else {
    return { level: 'low', label: 'low' };
  }
}
