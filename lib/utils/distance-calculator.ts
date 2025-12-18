/**
 * Distance Calculator Utility
 *
 * Provides functions to calculate distances between geographic coordinates
 * using the Haversine formula for great-circle distance calculations.
 */

/**
 * Convert degrees to radians
 */
function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate the great-circle distance between two points on Earth
 * using the Haversine formula.
 *
 * @param lat1 - Latitude of first point in degrees
 * @param lng1 - Longitude of first point in degrees
 * @param lat2 - Latitude of second point in degrees
 * @param lng2 - Longitude of second point in degrees
 * @returns Distance in kilometres (rounded to nearest integer)
 *
 * @example
 * const distance = calculateDistance(51.5074, -0.1278, 48.8566, 2.3522);
 * console.log(distance); // Distance from London to Paris: ~344 km
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  // Log inputs for debugging
  console.log('calculateDistance called with:', {
    lat1, lng1, lat2, lng2,
    types: [typeof lat1, typeof lng1, typeof lat2, typeof lng2],
    values: { lat1: Number(lat1), lng1: Number(lng1), lat2: Number(lat2), lng2: Number(lng2) }
  });

  // Ensure all inputs are numbers
  const numLat1 = Number(lat1);
  const numLng1 = Number(lng1);
  const numLat2 = Number(lat2);
  const numLng2 = Number(lng2);

  // Validate
  if (isNaN(numLat1) || isNaN(numLng1) || isNaN(numLat2) || isNaN(numLng2)) {
    console.error('Invalid coordinates:', { lat1, lng1, lat2, lng2 });
    return 0;
  }

  // Earth's radius in kilometres
  const R = 6371;

  // Convert latitude and longitude differences to radians
  const dLat = toRad(numLat2 - numLat1);
  const dLng = toRad(numLng2 - numLng1);

  // Haversine formula
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(numLat1)) *
    Math.cos(toRad(numLat2)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Distance in kilometres
  const distance = R * c;

  console.log('Calculated distance:', Math.round(distance), 'km');

  // Return rounded distance
  return Math.round(distance);
}

/**
 * Validate if coordinates are within valid ranges
 *
 * @param lat - Latitude to validate
 * @param lng - Longitude to validate
 * @returns true if coordinates are valid, false otherwise
 */
export function validateCoordinates(lat: number, lng: number): boolean {
  return (
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Calculate distance with validation
 * Returns null if coordinates are invalid
 *
 * @param lat1 - Latitude of first point
 * @param lng1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lng2 - Longitude of second point
 * @returns Distance in kilometres or null if invalid coordinates
 */
export function calculateDistanceSafe(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number | null {
  if (!validateCoordinates(lat1, lng1) || !validateCoordinates(lat2, lng2)) {
    return null;
  }

  return calculateDistance(lat1, lng1, lat2, lng2);
}

/**
 * Format distance for display with appropriate unit
 *
 * @param distanceKm - Distance in kilometres
 * @returns Formatted string with unit
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }

  if (distanceKm < 100) {
    return `${distanceKm.toFixed(1)} km`;
  }

  return `${Math.round(distanceKm)} km`;
}
