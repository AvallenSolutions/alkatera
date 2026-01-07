export function getConfidenceLevel(confidence: number): { label: string; color: string } {
  if (confidence >= 0.8) {
    return { label: 'High', color: 'green' };
  }
  if (confidence >= 0.5) {
    return { label: 'Medium', color: 'amber' };
  }
  return { label: 'Low', color: 'red' };
}
