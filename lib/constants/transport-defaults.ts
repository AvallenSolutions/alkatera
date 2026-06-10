// Default inbound transport assumptions for when a user knows only the
// origin country of an ingredient or packaging item.
//
// The forms already auto-calculate distance when both ends have coordinates.
// This module covers the common gap: a country is picked from the dropdown,
// no address is known, and previously the row silently got NO transport at
// all (mode without distance is dropped at save). A labelled, editable
// estimate beats silently counting zero transport.
//
// Estimates use the great-circle distance between country centroids with an
// uplift for real routing, and pick sea freight for intercontinental moves.
// They are deliberately rough and always shown as "estimated, please adjust".

import { calculateDistance } from '@/lib/utils/distance-calculator';

/** Approximate geographic centroids (lat, lng) for common origin countries. */
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  GB: [54.0, -2.0], IE: [53.4, -8.0], FR: [46.6, 2.2], DE: [51.1, 10.4],
  ES: [40.2, -3.6], PT: [39.6, -8.0], IT: [42.8, 12.8], NL: [52.2, 5.3],
  BE: [50.6, 4.6], LU: [49.8, 6.1], CH: [46.8, 8.2], AT: [47.6, 14.1],
  PL: [52.1, 19.4], CZ: [49.8, 15.5], SK: [48.7, 19.7], HU: [47.2, 19.4],
  RO: [45.8, 24.9], BG: [42.7, 25.5], GR: [39.0, 22.0], HR: [45.1, 15.2],
  SI: [46.1, 14.8], DK: [56.0, 10.0], SE: [62.0, 15.0], NO: [64.0, 11.0],
  FI: [64.5, 26.0], EE: [58.7, 25.0], LV: [56.9, 24.6], LT: [55.3, 23.9],
  UA: [49.0, 31.4], TR: [39.0, 35.0], CY: [35.0, 33.2], MT: [35.9, 14.4],
  US: [39.8, -98.6], CA: [56.1, -106.3], MX: [23.6, -102.6],
  BR: [-10.8, -53.1], AR: [-35.4, -65.2], CL: [-35.7, -71.5], PE: [-9.2, -75.0],
  CO: [4.1, -73.1], UY: [-32.8, -56.0], CR: [9.7, -84.2], JM: [18.1, -77.3],
  CU: [21.5, -79.0], DO: [18.9, -70.5], GT: [15.8, -90.2],
  CN: [36.6, 103.8], JP: [36.6, 138.0], KR: [36.4, 127.8], IN: [22.9, 79.6],
  TH: [15.1, 101.0], VN: [16.6, 106.3], ID: [-2.2, 117.4], MY: [3.8, 109.7],
  PH: [12.8, 122.9], LK: [7.6, 80.7], PK: [29.9, 69.4], BD: [23.9, 90.2],
  IL: [31.4, 35.0], AE: [23.9, 54.3], SA: [24.0, 45.0], GE: [42.2, 43.5],
  AU: [-25.7, 134.5], NZ: [-41.8, 172.8], FJ: [-17.8, 178.0],
  ZA: [-29.0, 25.1], KE: [0.5, 37.9], ET: [8.6, 39.6], UG: [1.3, 32.4],
  TZ: [-6.3, 34.8], GH: [7.9, -1.2], CI: [7.6, -5.6], NG: [9.6, 8.1],
  MA: [31.9, -6.3], TN: [34.1, 9.6], EG: [26.6, 29.9], MG: [-19.4, 46.7],
  EC: [-1.4, -78.4], BO: [-16.7, -64.7], PY: [-23.2, -58.4], VE: [7.1, -66.2],
  RU: [61.5, 105.3], IS: [64.9, -18.6], RS: [44.2, 20.8], MD: [47.2, 28.5],
};

export interface TransportDefault {
  mode: 'truck' | 'train' | 'ship' | 'air';
  distanceKm: number;
  /** Plain-language note shown next to the pre-filled values */
  assumption: string;
}

/**
 * Conservative fallback when we can't estimate at all ("I don't know where
 * it comes from"): long-haul sea freight plus road legs. Overestimates for
 * most real supply chains, so the user is never flattered by a guess.
 */
export const UNKNOWN_ORIGIN_DEFAULT: TransportDefault = {
  mode: 'ship',
  distanceKm: 15000,
  assumption: 'Origin unknown, so a conservative long-distance sea freight estimate is used. Adjust it when you know more.',
};

/**
 * Estimate inbound transport from an origin country to the production
 * location (coordinates when known, otherwise the destination country).
 * Returns null when the origin country isn't in the centroid table.
 */
export function defaultTransportForOrigin(input: {
  originCountryCode: string;
  destinationLat?: number | null;
  destinationLng?: number | null;
  destinationCountryCode?: string | null;
}): TransportDefault | null {
  const origin = COUNTRY_CENTROIDS[(input.originCountryCode || '').toUpperCase()];
  if (!origin) return null;

  let dest: [number, number] | null = null;
  if (input.destinationLat != null && input.destinationLng != null) {
    dest = [input.destinationLat, input.destinationLng];
  } else if (input.destinationCountryCode) {
    dest = COUNTRY_CENTROIDS[input.destinationCountryCode.toUpperCase()] ?? null;
  }
  if (!dest) return null;

  // Same-country supply with no better information: a domestic road leg.
  if (
    input.destinationCountryCode &&
    input.originCountryCode.toUpperCase() === input.destinationCountryCode.toUpperCase()
  ) {
    return {
      mode: 'truck',
      distanceKm: 300,
      assumption: 'Estimated domestic road freight. Adjust when you know the supplier location.',
    };
  }

  // Centroid-to-destination great circle, uplifted 30% for real routing.
  const straightLine = calculateDistance(origin[0], origin[1], dest[0], dest[1]);
  const routed = Math.round((straightLine * 1.3) / 50) * 50;

  if (routed <= 2500) {
    return {
      mode: 'truck',
      distanceKm: Math.max(routed, 100),
      assumption: 'Estimated road freight from the middle of the origin country. Adjust when you know the supplier location.',
    };
  }

  return {
    mode: 'ship',
    distanceKm: Math.max(routed, 1000),
    assumption: 'Estimated sea freight from the middle of the origin country. Adjust when you know the route.',
  };
}
