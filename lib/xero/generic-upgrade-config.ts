/**
 * Per-category configuration for the GenericUpgradeForm.
 *
 * Covers emission categories that don't have a dedicated bespoke form:
 * courier, employee_commuting, marketing_materials, capital_goods,
 * professional_services, it_services, telecoms, waste.
 *
 * Each entry provides the corporate_overheads category mapping, default
 * activity units, and DEFRA / industry-average default emission factors.
 * Users can override the factor per entry.
 */

export type GenericUpgradeCategory =
  | 'courier'
  | 'employee_commuting'
  | 'marketing_materials'
  | 'capital_goods'
  | 'professional_services'
  | 'it_services'
  | 'telecoms'
  | 'waste'

export type OverheadCategory =
  | 'business_travel'
  | 'purchased_services'
  | 'employee_commuting'
  | 'capital_goods'
  | 'upstream_transportation'
  | 'waste_disposal'
  | 'downstream_logistics'
  | 'operational_waste'
  | 'other'

interface UnitOption {
  value: string
  label: string
  /** Default kg CO2e per unit. Editable by the user. */
  defaultFactor: number
}

export interface GenericUpgradeConfig {
  label: string
  overheadCategory: OverheadCategory
  units: UnitOption[]
  guidance?: string
  materialType?: string
  assetType?: 'machinery' | 'vehicles' | 'it_hardware' | 'equipment' | 'other'
  disposalMethod?: 'landfill' | 'recycling' | 'composting' | 'incineration' | 'anaerobic_digestion'
}

export const GENERIC_UPGRADE_CONFIG: Record<GenericUpgradeCategory, GenericUpgradeConfig> = {
  courier: {
    label: 'Courier & Parcels',
    overheadCategory: 'upstream_transportation',
    units: [
      { value: 'parcels', label: 'parcels', defaultFactor: 0.5 },
      { value: 'tonne-km', label: 'tonne-km', defaultFactor: 0.107 },
    ],
    guidance:
      'For parcel carriers (DHL, Evri, Royal Mail). Use parcel count with a default 0.5 kg CO2e/parcel, or tonne-km if your carrier provides shipment weight and distance.',
  },
  employee_commuting: {
    label: 'Employee Commuting',
    overheadCategory: 'employee_commuting',
    units: [
      { value: 'passenger-km', label: 'passenger-km', defaultFactor: 0.171 },
      { value: 'FTE-year', label: 'FTE-year', defaultFactor: 2500 },
    ],
    guidance:
      'Scope 3.7. Use passenger-km (sum of each commuter\u2019s daily distance × working days) with a UK average of 0.171 kg CO2e/pkm, or enter FTE-year count with the default 2.5 tCO2e/FTE/year.',
  },
  marketing_materials: {
    label: 'Marketing Materials',
    overheadCategory: 'purchased_services',
    materialType: 'marketing_materials',
    units: [
      { value: 'kg', label: 'kg of material', defaultFactor: 1.05 },
      { value: 'items', label: 'printed items', defaultFactor: 0.15 },
    ],
    guidance:
      'Printed promo, merchandise, POS materials. Default 1.05 kg CO2e/kg for printed paper; adjust for textiles (~10 kg/kg) or plastic giveaways.',
  },
  capital_goods: {
    label: 'Capital Goods',
    overheadCategory: 'capital_goods',
    assetType: 'equipment',
    units: [
      { value: 'kg', label: 'kg of asset', defaultFactor: 2.8 },
      { value: 'units', label: 'units', defaultFactor: 300 },
    ],
    guidance:
      'Scope 3.2. Machinery, vehicles, IT hardware, fixtures. Default 2.8 kg CO2e/kg covers mixed steel/electronics; use supplier EPD where available.',
  },
  professional_services: {
    label: 'Professional Services',
    overheadCategory: 'purchased_services',
    units: [
      { value: 'FTE-hours', label: 'FTE-hours', defaultFactor: 0.5 },
      { value: 'GBP', label: '\u00a3 spend (EEIO)', defaultFactor: 0.25 },
    ],
    guidance:
      'Legal, accounting, consulting. EEIO-based default is 0.25 kg CO2e/\u00a3; switch to FTE-hours (~0.5 kg/hr office-based) when supplier provides timesheets.',
  },
  it_services: {
    label: 'IT Services',
    overheadCategory: 'purchased_services',
    units: [
      { value: 'kWh', label: 'kWh (hosting)', defaultFactor: 0.207 },
      { value: 'user-months', label: 'user-months (SaaS)', defaultFactor: 0.6 },
    ],
    guidance:
      'Cloud hosting, SaaS subscriptions. Use provider-reported kWh where possible. Default SaaS factor 0.6 kg/user-month is a rough industry estimate.',
  },
  telecoms: {
    label: 'Telecoms',
    overheadCategory: 'purchased_services',
    units: [
      { value: 'line-months', label: 'line-months', defaultFactor: 2.0 },
      { value: 'GB', label: 'GB data', defaultFactor: 0.06 },
    ],
    guidance:
      'Phone lines, mobile contracts, broadband. Default 2 kg CO2e/line-month; add data volume for heavy users.',
  },
  waste: {
    label: 'Waste',
    overheadCategory: 'operational_waste',
    disposalMethod: 'landfill',
    units: [
      { value: 'tonnes', label: 'tonnes', defaultFactor: 467 },
      { value: 'kg', label: 'kg', defaultFactor: 0.467 },
    ],
    guidance:
      'Scope 3.5. Default 467 kg CO2e/tonne is DEFRA mixed-landfill; recycling (~21 kg/t) and composting (~10 kg/t) are far lower \u2013 update the factor to match your waste stream.',
  },
}
