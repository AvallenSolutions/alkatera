// Per-framework content: the requirement set, guidance and auto-evidence
// mapping for certifications beyond B Corp (ISO 14001/50001, EcoVadis).
// One source of truth used to (a) generate the seed migration, (b) drive
// requirement guidance, and (c) drive auto-evidence via shared platform probes.

/**
 * Named, reusable checks against alkatera data. Each framework requirement maps
 * to at most one probe; the probe decides whether platform data partly
 * satisfies it. Keeps ~70 requirements covered by ~18 shared checks.
 */
export type ProbeId =
  | 'facilities'
  | 'emissionsInventory'
  | 'emissionsTarget'
  | 'reductionPlan'
  | 'energyData'
  | 'waterData'
  | 'wasteData'
  | 'metricTrend'
  | 'productLca'
  | 'productLcaEol'
  | 'productionLogs'
  | 'training'
  | 'workforceDemographics'
  | 'compensation'
  | 'governancePolicies'
  | 'governanceMission'
  | 'governanceEthics'
  | 'community'
  | 'supplierEsg';

export interface FrameworkRequirementDef {
  /** Stable requirement code, e.g. "ISO14001-6.2". */
  code: string;
  /** Short paraphrased title. */
  name: string;
  /** Clause group / theme used as topic_area. */
  category: string;
  /** Plain-English "what this needs". */
  summary: string;
  /** Accepted-evidence examples. */
  evidence: string[];
  /** Common pitfalls. */
  pitfalls?: string[];
  /** Shared platform probe that partly satisfies this requirement, if any. */
  probe?: ProbeId | null;
}

export interface FrameworkContentDef {
  /** framework_code, e.g. "iso14001". */
  code: string;
  /** Display label. */
  label: string;
  /** Fixed framework UUID (matches the certification_frameworks seed row). */
  frameworkId: string;
  /** UUID namespace prefix for deterministic requirement ids in the migration. */
  reqIdPrefix: string;
  /** Category order for grouping in the UI. */
  categoryOrder: string[];
  requirements: FrameworkRequirementDef[];
}
