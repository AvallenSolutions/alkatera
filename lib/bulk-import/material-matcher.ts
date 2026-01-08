export function getConfidenceLevel(confidence: number | null): string {
  if (confidence === null) return 'none';
  if (confidence >= 90) return 'high';
  if (confidence >= 70) return 'medium';
  if (confidence >= 50) return 'low';
  return 'very-low';
}

export function getConfidenceColor(confidence: number | null): string {
  const level = getConfidenceLevel(confidence);
  switch (level) {
    case 'high':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
    case 'medium':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100';
    case 'low':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100';
    case 'very-low':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-100';
  }
}
