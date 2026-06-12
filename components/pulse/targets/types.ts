import type { MetricKey } from '@/lib/pulse/metric-keys';
import type { InitiativeStatus } from '@/lib/pulse/initiative-status';

export interface Target {
  id: string;
  metric_key: MetricKey;
  baseline_value: number;
  baseline_date: string;
  target_value: number;
  target_date: string;
  methodology?: string | null;
  notes: string | null;
}

export interface Initiative {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  lever_id: string | null;
  status: InitiativeStatus;
  submitted_at: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  owner_user_id: string | null;
  owner_name: string | null;
  start_date: string | null;
  end_date: string | null;
  budget_estimated_gbp: number | null;
  budget_approved_gbp: number | null;
  budget_spent_gbp: number | null;
  expected_annual_reduction_value: number | null;
  expected_annual_reduction_unit: string | null;
  actual_impact_notes: string | null;
  percent_complete: number;
  progress_notes: string | null;
  progress_updated_at: string | null;
  created_by: string | null;
  initiative_target_links?: Array<{ target_id: string }>;
}

export function initiativeTargetIds(i: Initiative): string[] {
  return (i.initiative_target_links ?? []).map((l) => l.target_id);
}
