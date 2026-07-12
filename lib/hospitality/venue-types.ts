/**
 * Hospitality venue vocabulary — shared between the API (validation) and the UI
 * (labels). A venue is a restaurant, bar, or accommodation belonging to an
 * organisation; it anchors per-venue reporting and energy/water allocation.
 */

export const VENUE_TYPES = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'bar', label: 'Bar' },
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'events', label: 'Events' },
] as const;

export type VenueType = (typeof VENUE_TYPES)[number]['value'];

export const VENUE_TYPE_VALUES = new Set<string>(VENUE_TYPES.map((v) => v.value));

export const VENUE_STATUSES = ['active', 'archived'] as const;
export type VenueStatus = (typeof VENUE_STATUSES)[number];
export const VENUE_STATUS_VALUES = new Set<string>(VENUE_STATUSES);

export interface HospitalityVenue {
  id: string;
  organization_id: string;
  facility_id: string | null;
  name: string;
  venue_type: VenueType;
  description: string | null;
  status: VenueStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export function venueTypeLabel(value: string): string {
  return VENUE_TYPES.find((v) => v.value === value)?.label ?? value;
}
