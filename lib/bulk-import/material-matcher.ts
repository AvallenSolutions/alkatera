export function getConfidenceLevel(confidence: number | null): { label: string; color: string } {
  if (!confidence) return { label: 'unknown', color: 'gray' };
  if (confidence >= 0.9) return { label: 'high', color: 'green' };
  if (confidence >= 0.7) return { label: 'medium', color: 'yellow' };
  return { label: 'low', color: 'red' };
}
