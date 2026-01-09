export interface ConfidenceLevel {
  level: 'high' | 'medium' | 'low' | 'none';
  label: string;
  color: string;
}

export function getConfidenceLevel(confidence: number | null): ConfidenceLevel {
  if (confidence === null) return { level: 'none', label: 'No Match', color: 'text-gray-500' };
  if (confidence >= 0.8) return { level: 'high', label: 'High Confidence', color: 'text-green-600' };
  if (confidence >= 0.5) return { level: 'medium', label: 'Medium Confidence', color: 'text-amber-600' };
  if (confidence > 0) return { level: 'low', label: 'Low Confidence', color: 'text-red-600' };
  return { level: 'none', label: 'No Match', color: 'text-gray-500' };
}
