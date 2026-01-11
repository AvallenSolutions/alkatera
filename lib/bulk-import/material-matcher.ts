export type ConfidenceLevelName = 'high' | 'medium' | 'low' | 'none';

export interface ConfidenceLevel {
  name: ConfidenceLevelName;
  label: string;
  color: string;
}

export function getConfidenceLevel(confidence: number | null): ConfidenceLevel {
  if (confidence === null || confidence === 0) {
    return { name: 'none', label: 'No Match', color: 'text-slate-400' };
  }
  if (confidence >= 0.8) {
    return { name: 'high', label: 'High', color: 'text-green-600' };
  }
  if (confidence >= 0.5) {
    return { name: 'medium', label: 'Medium', color: 'text-amber-600' };
  }
  return { name: 'low', label: 'Low', color: 'text-red-600' };
}

export function getConfidenceColor(level: ConfidenceLevelName): string {
  switch (level) {
    case 'high':
      return 'text-green-600';
    case 'medium':
      return 'text-amber-600';
    case 'low':
      return 'text-red-600';
    default:
      return 'text-slate-400';
  }
}
