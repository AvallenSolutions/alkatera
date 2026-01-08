interface ConfidenceLevel {
  level: 'high' | 'medium' | 'low' | 'none';
  label: string;
  color: string;
}

export function getConfidenceLevel(confidence: number | null): ConfidenceLevel {
  if (confidence === null || confidence === 0) {
    return { level: 'none', label: 'No match', color: 'gray' };
  }
  if (confidence >= 0.8) {
    return { level: 'high', label: 'High confidence', color: 'green' };
  }
  if (confidence >= 0.5) {
    return { level: 'medium', label: 'Medium confidence', color: 'amber' };
  }
  return { level: 'low', label: 'Low confidence', color: 'red' };
}
