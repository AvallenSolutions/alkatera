export interface ConfidenceLevelResult {
  level: 'high' | 'medium' | 'low' | 'unknown';
  label: string;
  color: string;
}

export function getConfidenceLevel(score: number): ConfidenceLevelResult {
  if (score >= 0.8) return { level: 'high', label: 'High Confidence', color: 'text-green-500' };
  if (score >= 0.5) return { level: 'medium', label: 'Medium Confidence', color: 'text-yellow-500' };
  if (score >= 0.2) return { level: 'low', label: 'Low Confidence', color: 'text-orange-500' };
  return { level: 'unknown', label: 'Unknown', color: 'text-gray-500' };
}

export function matchMaterial(name: string): { match: string | null; confidence: number } {
  return { match: null, confidence: 0 };
}
