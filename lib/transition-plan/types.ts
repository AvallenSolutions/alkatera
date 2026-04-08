/**
 * Transition Plan Domain Types
 *
 * Shared across API routes, AI assistants, UI components, and the PDF renderer.
 * Mirrors the JSONB shapes stored in the transition_plans table.
 */

export interface ReductionTarget {
  id: string;
  scope: 'scope1' | 'scope2' | 'scope3' | 'total';
  targetYear: number;
  reductionPct: number;        // Percentage reduction vs. baseline_year (e.g. 50 = 50%)
  absoluteTargetTco2e?: number;
  notes?: string;
}

export interface TransitionMilestone {
  id: string;
  title: string;
  targetDate: string;                                     // ISO date YYYY-MM-DD
  status: 'not_started' | 'in_progress' | 'complete';
  linkedEventId?: string;                                 // FK to operational_change_events
  scopeReference?: 'scope1' | 'scope2' | 'scope3';
  emissionsImpactTco2e?: number;
  notes?: string;
}

export interface RiskOpportunity {
  id: string;
  type: 'risk' | 'opportunity';
  category: 'physical' | 'transition' | 'regulatory' | 'reputational' | 'financial';
  title: string;
  description: string;
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  timeHorizon: 'short' | 'medium' | 'long';
  aiGenerated: boolean;
}

export interface TransitionPlan {
  id: string;
  organization_id: string;
  plan_year: number;
  baseline_year: number;
  baseline_emissions_tco2e: number | null;
  targets: ReductionTarget[];
  milestones: TransitionMilestone[];
  risks_and_opportunities: RiskOpportunity[] | null;
  sbti_aligned: boolean;
  sbti_target_year: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

export const SCOPE_LABELS: Record<ReductionTarget['scope'], string> = {
  scope1: 'Scope 1 (Direct)',
  scope2: 'Scope 2 (Electricity)',
  scope3: 'Scope 3 (Value Chain)',
  total:  'Total (All Scopes)',
};

export const SCOPE_COLOURS: Record<ReductionTarget['scope'], string> = {
  scope1: '#22c55e',
  scope2: '#3b82f6',
  scope3: '#f97316',
  total:  '#8b5cf6',
};

export const MILESTONE_STATUS_LABELS: Record<TransitionMilestone['status'], string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  complete:    'Complete',
};

export const MILESTONE_STATUS_COLOURS: Record<TransitionMilestone['status'], string> = {
  not_started: '#78716c',
  in_progress: '#f59e0b',
  complete:    '#22c55e',
};

export const CATEGORY_LABELS: Record<RiskOpportunity['category'], string> = {
  physical:      'Physical',
  transition:    'Transition',
  regulatory:    'Regulatory',
  reputational:  'Reputational',
  financial:     'Financial',
};

export const LIKELIHOOD_LABELS: Record<RiskOpportunity['likelihood'], string> = {
  low:    'Low',
  medium: 'Medium',
  high:   'High',
};

export const IMPACT_LABELS: Record<RiskOpportunity['impact'], string> = {
  low:    'Low',
  medium: 'Medium',
  high:   'High',
};

export const TIME_HORIZON_LABELS: Record<RiskOpportunity['timeHorizon'], string> = {
  short:  'Short-term (1-3 years)',
  medium: 'Medium-term (3-10 years)',
  long:   'Long-term (10+ years)',
};
