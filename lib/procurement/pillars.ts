// The procurement portal uses the canonical, shared six-pillar model so it stays
// in lockstep with the distributor portal. Kept as a re-export for existing imports.
export {
  PILLARS,
  FIELD_REGISTRY,
  pillarForField,
  fieldLabel,
  formatFieldValue,
  groupByPillar,
} from '@/lib/sustainability/pillars'
export type { PillarKey, PillarDef, Fmt, FieldMeta, PillarFinding, PillarGroup } from '@/lib/sustainability/pillars'
