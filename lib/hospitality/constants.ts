/**
 * Shared hospitality discriminators. `products.product_kind` is 'product' for
 * normal products and one of these for hospitality recipes. Single source of
 * truth so the corporate-emissions rollup, the hospitality calculators and the
 * dashboard all agree on what counts as hospitality.
 */

export const HOSPITALITY_KINDS = [
  'hospitality_meal',
  'hospitality_drink',
  'hospitality_room_night',
] as const

export type HospitalityKind = (typeof HOSPITALITY_KINDS)[number]

export function isHospitalityKind(kind: string | null | undefined): boolean {
  return !!kind && (HOSPITALITY_KINDS as readonly string[]).includes(kind)
}
