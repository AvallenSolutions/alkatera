export interface ConfidenceLevel {
  level: 'high' | 'medium' | 'low' | 'none';
  label: string;
  score: number;
}

export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.8) {
    return { level: 'high', label: 'High', score };
  }
  if (score >= 0.6) {
    return { level: 'medium', label: 'Medium', score };
  }
  if (score >= 0.4) {
    return { level: 'low', label: 'Low', score };
  }
  return { level: 'none', label: 'None', score };
}
