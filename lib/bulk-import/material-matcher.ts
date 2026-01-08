export function getConfidenceLevel(confidence: number | null): {
  label: string;
  color: string;
} {
  if (confidence === null) {
    return { label: 'Unmatched', color: 'gray' };
  }

  if (confidence >= 90) {
    return { label: 'High', color: 'green' };
  } else if (confidence >= 70) {
    return { label: 'Medium', color: 'yellow' };
  } else {
    return { label: 'Low', color: 'red' };
  }
}
