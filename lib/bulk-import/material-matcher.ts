export function getConfidenceLevel(confidence: number): { label: string; color: string } {
  if (confidence >= 0.9) {
    return { label: 'High', color: 'green' };
  } else if (confidence >= 0.7) {
    return { label: 'Medium', color: 'amber' };
  } else if (confidence >= 0.5) {
    return { label: 'Low', color: 'orange' };
  } else {
    return { label: 'None', color: 'red' };
  }
}
