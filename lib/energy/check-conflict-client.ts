/**
 * Client helper for the smart-meter conflict pre-flight (manual entry, rollover).
 * Calls /api/utilities/smart-meter-conflict.
 */

export interface SmartMeterConflict {
  conflict: boolean;
  existing: { utilityType: string; from: string; to: string; quantity: number }[];
}

/** Does smart-meter data overlap these facility/months for electricity/gas? */
export async function checkSmartMeterConflict(
  facilityId: string,
  utilityTypes: string[],
  periodStart: string,
  periodEnd: string,
): Promise<SmartMeterConflict> {
  try {
    const res = await fetch('/api/utilities/smart-meter-conflict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facilityId, utilityTypes, periodStart, periodEnd }),
    });
    if (!res.ok) return { conflict: false, existing: [] };
    return await res.json();
  } catch {
    return { conflict: false, existing: [] };
  }
}

/** Remove the overlapping smart-meter data so a bill/manual entry can be saved. */
export async function resolveSmartMeterConflict(
  facilityId: string,
  utilityTypes: string[],
  periodStart: string,
  periodEnd: string,
): Promise<void> {
  await fetch('/api/utilities/smart-meter-conflict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ facilityId, utilityTypes, periodStart, periodEnd, action: 'replace' }),
  });
}
