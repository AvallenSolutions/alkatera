/**
 * Material matching utilities for bulk import
 * Provides confidence level helpers and matching logic
 */

/**
 * Converts a numeric confidence score (0-1) to a human-readable level
 * @param confidence - A number between 0 and 1 representing match confidence
 * @returns A string describing the confidence level
 */
export function getConfidenceLevel(confidence: number): string {
  if (confidence >= 0.9) {
    return 'Excellent';
  } else if (confidence >= 0.75) {
    return 'High';
  } else if (confidence >= 0.5) {
    return 'Medium';
  } else if (confidence >= 0.25) {
    return 'Low';
  } else {
    return 'Very Low';
  }
}

/**
 * Gets a color class based on confidence level for UI styling
 * @param confidence - A number between 0 and 1 representing match confidence
 * @returns A Tailwind CSS color class
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) {
    return 'text-green-600';
  } else if (confidence >= 0.75) {
    return 'text-blue-600';
  } else if (confidence >= 0.5) {
    return 'text-yellow-600';
  } else if (confidence >= 0.25) {
    return 'text-orange-600';
  } else {
    return 'text-red-600';
  }
}
