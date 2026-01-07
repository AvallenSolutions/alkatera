export function getConfidenceLevel(confidence: number | null): { label: string; color: string } {
  if (confidence === null) return { label: 'None', color: 'gray' };
  if (confidence >= 0.9) return { label: 'High', color: 'green' };
  if (confidence >= 0.7) return { label: 'Medium', color: 'yellow' };
  return { label: 'Low', color: 'red' };
}
