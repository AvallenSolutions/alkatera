export interface ConfidenceLevel {
  label: string
  color: string
}

export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.9) {
    return { label: 'Very High', color: 'green' }
  } else if (confidence >= 0.7) {
    return { label: 'High', color: 'blue' }
  } else if (confidence >= 0.5) {
    return { label: 'Medium', color: 'amber' }
  } else if (confidence >= 0.3) {
    return { label: 'Low', color: 'orange' }
  }
  return { label: 'Very Low', color: 'red' }
}

export function matchMaterialName(name: string): { id: string; confidence: number } | null {
  if (!name || name.length < 2) {
    return null
  }

  return null
}
