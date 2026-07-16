/**
 * Hospitality compliance exports. Assembles existing calculations into the shape
 * three common frameworks expect, as structured rows + CSV:
 *   - secr       — UK Streamlined Energy & Carbon Reporting (energy + carbon + intensity)
 *   - agec       — France AGEC anti-waste (food waste mass + diversion)
 *   - cool_food  — Cool Food Pledge food-emissions baseline
 * These are data-assembly exports for onward submission, not filings in themselves.
 */

import { calculateHospitality } from '@/lib/calculations/hospitality-emissions'
import { summariseWaste } from './waste-service'
import { computeBenchmarking } from './benchmarking'
import { computeIntensity } from './operating-service'

type Db = any

export const COMPLIANCE_FRAMEWORKS = ['secr', 'agec', 'cool_food'] as const
export type ComplianceFramework = (typeof COMPLIANCE_FRAMEWORKS)[number]

export interface ComplianceRow {
  metric: string
  value: number | null
  unit: string
}

export interface ComplianceExport {
  framework: ComplianceFramework
  framework_label: string
  year: number
  rows: ComplianceRow[]
  note: string
}

const LABELS: Record<ComplianceFramework, string> = {
  secr: 'SECR (UK Streamlined Energy & Carbon Reporting)',
  agec: 'France AGEC anti-waste',
  cool_food: 'Cool Food Pledge food-emissions baseline',
}

export async function computeCompliance(db: Db, organizationId: string, year: number, framework: ComplianceFramework): Promise<ComplianceExport> {
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`
  const base = { framework, framework_label: LABELS[framework], year }

  if (framework === 'secr') {
    const bench = await computeBenchmarking(db, organizationId, year)
    const hosp = await calculateHospitality(db, organizationId, yearStart, yearEnd)
    const intensity = await computeIntensity(db, organizationId, yearStart, yearEnd, { total: hosp.total, supplies: hosp.supplies })
    return {
      ...base,
      note: 'Energy from accommodation facilities plus the hospitality Scope 3 element and an intensity ratio. Combine with your full org SECR for filing.',
      rows: [
        { metric: 'Energy consumption', value: bench.energy_kwh, unit: 'kWh' },
        { metric: 'Electricity', value: bench.electricity_kwh, unit: 'kWh' },
        { metric: 'Gas', value: bench.gas_kwh, unit: 'kWh' },
        { metric: 'Energy carbon', value: bench.energy_co2e, unit: 'kg CO2e' },
        { metric: 'Hospitality Scope 3 (food + supplies + waste)', value: hosp.total, unit: 'kg CO2e' },
        { metric: 'Carbon per cover', value: intensity.per_cover, unit: 'kg CO2e/cover' },
        { metric: 'Carbon per room-night', value: bench.co2e_per_night, unit: 'kg CO2e/night' },
      ],
    }
  }

  if (framework === 'agec') {
    const waste = await summariseWaste(db, organizationId, yearStart, yearEnd)
    return {
      ...base,
      note: 'Food-waste mass and diversion for the AGEC anti-waste reporting. Includes only hospitality waste logged in the module.',
      rows: [
        { metric: 'Total food waste', value: waste.food_kg, unit: 'kg' },
        { metric: 'Total dry waste', value: waste.dry_kg, unit: 'kg' },
        { metric: 'Waste diverted from disposal', value: waste.diverted_kg, unit: 'kg' },
        { metric: 'Diversion rate', value: Math.round(waste.diversion_rate * 1000) / 10, unit: '%' },
        { metric: 'Waste carbon', value: waste.total_co2e, unit: 'kg CO2e' },
      ],
    }
  }

  // cool_food
  const hosp = await calculateHospitality(db, organizationId, yearStart, yearEnd)
  const intensity = await computeIntensity(db, organizationId, yearStart, yearEnd, { total: hosp.total, supplies: hosp.supplies })
  return {
    ...base,
    note: 'Food & drink emissions baseline for the Cool Food Pledge (25% reduction by 2030 target is measured against this).',
    rows: [
      { metric: 'Food & drink served (carbon)', value: hosp.food, unit: 'kg CO2e' },
      { metric: 'Embodied water', value: hosp.water_m3, unit: 'm3' },
      { metric: 'Embodied land', value: hosp.land_m2, unit: 'm2' },
      { metric: 'Carbon per cover', value: intensity.per_cover, unit: 'kg CO2e/cover' },
      { metric: 'Covers served', value: intensity.covers, unit: 'covers' },
    ],
  }
}

function cell(v: number | null): string {
  return v == null ? '' : String(Math.round(v * 1000) / 1000)
}

export function complianceCsv(e: ComplianceExport): string {
  const header = ['framework', 'year', 'metric', 'value', 'unit']
  const rows = e.rows.map((r) => [e.framework, String(e.year), r.metric, cell(r.value), r.unit])
  return [header, ...rows].map((r) => r.map((c) => (c.includes(',') ? `"${c}"` : c)).join(',')).join('\n')
}
