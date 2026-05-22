/**
 * Producer-level supplier responsibility attestations.
 *
 * Six declarations the producer makes about their own supply-chain
 * practices. Sourced from CSRD ESRS S2 (Workers in the value chain),
 * UK Modern Slavery Act 2015, and B Corp Workers + Community impact
 * areas.
 *
 * None require suppliers to engage with the platform — the producer
 * declares what they are doing today, and we score on that. As the
 * supplier ESG form gains adoption, those scores will layer on top
 * as a bonus (v2).
 */

export type SupplierAttestationType =
  | 'supplier_code_of_conduct'
  | 'annual_supplier_risk_assessment'
  | 'supplier_audits_last_12_months'
  | 'living_wage_in_contracts'
  | 'modern_slavery_policy'
  | 'supplier_diversity_programme'

export interface AttestationMeta {
  value: SupplierAttestationType
  label: string
  description: string
  framework: string
  emoji: string
}

export const SUPPLIER_ATTESTATIONS: AttestationMeta[] = [
  {
    value: 'supplier_code_of_conduct',
    label: 'Written supplier code of conduct',
    description:
      'A formal document setting out the labour, ethics, environment, and human-rights standards your suppliers must meet, shared with each supplier.',
    framework: 'CSRD ESRS S2 · B Corp Workers',
    emoji: '📜',
  },
  {
    value: 'annual_supplier_risk_assessment',
    label: 'Annual supplier risk assessment',
    description:
      'A documented review of supply-chain risks (country, sector, product) carried out in the last 12 months.',
    framework: 'CSRD ESRS S2 · UK Modern Slavery Act',
    emoji: '🔍',
  },
  {
    value: 'supplier_audits_last_12_months',
    label: 'Supplier audits performed in the last 12 months',
    description:
      'On-site, third-party, or self-assessment audits covering at least your highest-risk suppliers.',
    framework: 'CSRD ESRS S2 · SA8000',
    emoji: '✅',
  },
  {
    value: 'living_wage_in_contracts',
    label: 'Living Wage requirement in supplier contracts',
    description:
      'Your supplier contracts include a binding requirement to pay at least a recognised Living Wage (or local equivalent).',
    framework: 'B Corp Workers · Living Wage Foundation',
    emoji: '💷',
  },
  {
    value: 'modern_slavery_policy',
    label: 'Modern slavery / human-trafficking policy',
    description:
      'A published policy with named owner, supplier-engagement process, and grievance mechanism.',
    framework: 'UK Modern Slavery Act 2015 · CSRD ESRS S2',
    emoji: '🛡️',
  },
  {
    value: 'supplier_diversity_programme',
    label: 'Supplier diversity programme',
    description:
      'Active sourcing programme prioritising suppliers owned by women, ethnic minorities, B Corps, social enterprises, or other under-represented groups.',
    framework: 'B Corp Community · CSRD ESRS S2',
    emoji: '🤝',
  },
]

const META_BY_VALUE: Record<SupplierAttestationType, AttestationMeta> = (() => {
  const map = {} as Record<SupplierAttestationType, AttestationMeta>
  for (const m of SUPPLIER_ATTESTATIONS) map[m.value] = m
  return map
})()

export function getAttestationMeta(
  value: string | null | undefined,
): AttestationMeta | null {
  if (!value) return null
  return META_BY_VALUE[value as SupplierAttestationType] ?? null
}

/**
 * Score = % of the 6 attestations marked as attested. Returns 0 when
 * none are declared (not null) — Tim's locked preference is to penalise
 * data gaps rather than redistribute, so missing = 0.
 */
export function computeAttestationsScore(
  attested: SupplierAttestationType[],
): number {
  if (SUPPLIER_ATTESTATIONS.length === 0) return 0
  const distinct = new Set(attested.filter(t => META_BY_VALUE[t] !== undefined))
  return Math.round(
    (distinct.size / SUPPLIER_ATTESTATIONS.length) * 100,
  )
}
