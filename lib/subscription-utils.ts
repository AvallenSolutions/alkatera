/**
 * Client-safe subscription utility functions
 * These are pure functions that can be used in both client and server components
 */

/**
 * Calculate usage as a percentage
 */
export function calculateUsagePercentage(current: number, max: number | null): number {
  if (max === null) return 0; // Unlimited
  if (max === 0) return 100;
  return Math.min(Math.round((current / max) * 100), 100);
}

/**
 * Get usage status color for UI
 */
export function getUsageStatusColor(percentage: number): string {
  if (percentage < 70) return 'green';
  if (percentage < 90) return 'yellow';
  return 'red';
}

/**
 * Check if organization is approaching limit
 */
export function isApproachingLimit(current: number, max: number | null): boolean {
  if (max === null) return false; // Unlimited
  return current >= max * 0.8; // 80% threshold
}
