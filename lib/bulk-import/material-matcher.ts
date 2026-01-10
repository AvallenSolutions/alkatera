export type ConfidenceLevelString = 'high' | 'medium' | 'low' | 'none';

export interface ConfidenceLevel {
  level: ConfidenceLevelString;
  label: string;
  color: string;
  badgeClass: string;
}

export function getConfidenceLevel(score: number | null): ConfidenceLevel {
  if (score === null || score === 0) {
    return {
      level: 'none',
      label: 'No Match',
      color: 'text-slate-400',
      badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
    };
  }
  if (score >= 0.8) {
    return {
      level: 'high',
      label: 'High Confidence',
      color: 'text-green-600',
      badgeClass: 'bg-green-100 text-green-800 border-green-200',
    };
  }
  if (score >= 0.5) {
    return {
      level: 'medium',
      label: 'Medium Confidence',
      color: 'text-amber-600',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    };
  }
  return {
    level: 'low',
    label: 'Low Confidence',
    color: 'text-red-600',
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
  };
}

export function getConfidenceColor(level: ConfidenceLevelString): string {
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

export function getConfidenceBadgeClass(level: ConfidenceLevelString): string {
  switch (level) {
    case 'high':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'medium':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'low':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-200';
  }
}
