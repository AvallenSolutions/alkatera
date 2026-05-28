/**
 * Rosa — progress-tracker registry.
 *
 * Each tracker is a "thing the user wants to watch over time" on the
 * /rosa/ hub. The registry defines what it tracks, how to render the
 * value, what unit + tone to use, and what comparison overlay (target,
 * baseline, benchmark) makes sense.
 *
 * The actual timeseries computation lives in priority-tracker-signals;
 * this file is the catalogue of what's available.
 */

export type ProgressTrackerId =
  | 'total_emissions'
  | 'water_use'
  | 'lca_coverage'
  | 'supplier_esg_signal'
  | 'target_progress'
  | 'custom_rosa'

export type ComparisonKind = 'target' | 'baseline' | 'benchmark' | 'none'

export interface ProgressTrackerDefinition {
  id: ProgressTrackerId
  label: string
  description: string
  /** Display unit shown next to values. e.g. 'kg CO₂e', '%', 'm³'. */
  unit: string
  /** When higher = improvement, set this true. Drives delta-direction colours. */
  higher_is_better: boolean
  /** Default comparison overlay shape. The signal layer may downgrade if data is unavailable. */
  default_comparison: ComparisonKind
  /** Where the card's "open" link points (no query params). */
  href: string
  /** Short tagline used in the chip picker. */
  tagline: string
}

export const PROGRESS_TRACKERS: Record<ProgressTrackerId, ProgressTrackerDefinition> = {
  total_emissions: {
    id: 'total_emissions',
    label: 'Total emissions',
    description: 'Your full scope 1+2+3 corporate emissions over time. The headline footprint number.',
    unit: 't CO₂e',
    higher_is_better: false,
    default_comparison: 'baseline',
    href: '/data/scope-1-2/',
    tagline: 'Watch your footprint move.',
  },
  water_use: {
    id: 'water_use',
    label: 'Water use',
    description: 'Operational water intake across your facilities.',
    unit: 'm³',
    higher_is_better: false,
    default_comparison: 'baseline',
    href: '/data/scope-1-2/',
    tagline: 'Track water as a leading indicator.',
  },
  lca_coverage: {
    id: 'lca_coverage',
    label: 'LCA coverage',
    description: 'Share of your products with a completed LCA. Builds the data foundation.',
    unit: '%',
    higher_is_better: true,
    default_comparison: 'baseline',
    href: '/products/',
    tagline: 'Are we measuring the portfolio?',
  },
  supplier_esg_signal: {
    id: 'supplier_esg_signal',
    label: 'Supplier ESG signal',
    description: 'Share of your suppliers with a submitted ESG self-assessment.',
    unit: '%',
    higher_is_better: true,
    default_comparison: 'baseline',
    href: '/suppliers/',
    tagline: 'Are suppliers getting on board?',
  },
  target_progress: {
    id: 'target_progress',
    label: 'Target progress',
    description: 'Actual trajectory against the linear path to your reduction target.',
    unit: '%',
    higher_is_better: true,
    default_comparison: 'target',
    href: '/pulse/targets/',
    tagline: 'Are we on track to hit the target?',
  },
  custom_rosa: {
    id: 'custom_rosa',
    label: 'Rosa-curated',
    description: 'Rosa picks the most-valuable thing to watch for this org right now.',
    unit: '',
    higher_is_better: true,
    default_comparison: 'baseline',
    href: '/rosa/',
    tagline: 'Let Rosa pick the headline number.',
  },
}

export const PROGRESS_TRACKER_IDS = Object.keys(PROGRESS_TRACKERS) as ProgressTrackerId[]

export interface StoredTrackerConfig {
  v: 1
  tracker_id: ProgressTrackerId
  /** Optional: when tracker_id is 'target_progress', which target to track. */
  target_id?: string
  /** When custom_rosa, the resolved tracker Rosa most recently picked. */
  resolved_id?: ProgressTrackerId
  set_at: string
  set_by: 'user_chip' | 'rosa_proposal'
}

export function isStoredTrackerConfig(v: unknown): v is StoredTrackerConfig {
  if (!v || typeof v !== 'object') return false
  const cfg = v as Partial<StoredTrackerConfig>
  return (
    cfg.v === 1 &&
    typeof cfg.tracker_id === 'string' &&
    cfg.tracker_id in PROGRESS_TRACKERS
  )
}
