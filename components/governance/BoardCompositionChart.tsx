'use client';

import { Panel } from '@/components/studio/panel';
import { StateChip } from '@/components/studio/state-chip';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Users,
  User,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Pencil,
  Trash2,
} from 'lucide-react';
import { BoardMember, BoardMetrics } from '@/hooks/data/useBoardComposition';

interface BoardCompositionChartProps {
  members: BoardMember[];
  metrics: BoardMetrics;
  isLoading?: boolean;
  onEditMember?: (member: BoardMember) => void;
  onDeleteMember?: (member: BoardMember) => void;
}

function MetricCard({
  title,
  value,
  target,
  isGood,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  target?: string;
  isGood?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Panel className="p-4">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-[6px] flex items-center justify-center ${
          isGood === undefined ? 'bg-studio-ink/[0.05] text-studio-dim' :
          isGood ? 'bg-studio-good/10 text-studio-good' :
          'bg-studio-attention/10 text-studio-attention'
        }`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-display font-bold">{value}</p>
          {target && (
            <p className="text-xs text-muted-foreground">Target: {target}</p>
          )}
        </div>
      </div>
    </Panel>
  );
}

// Board diversity is categorical data-viz: distinct studio inks per category,
// muted to gallery grade, not a working-tone ladder.
const GENDER_SEGMENTS = [
  { key: 'male' as const, label: 'Male', colour: 'bg-studio-cobalt' },
  { key: 'female' as const, label: 'Female', colour: 'bg-studio-plum' },
  { key: 'other' as const, label: 'Other', colour: 'bg-studio-ochre' },
  { key: 'not_disclosed' as const, label: 'Not Disclosed', colour: 'bg-studio-dim' },
];

function GenderBreakdownChart({ breakdown }: { breakdown: BoardMetrics['gender_breakdown'] }) {
  const total = breakdown.male + breakdown.female + breakdown.other + breakdown.not_disclosed;
  if (total === 0) return null;

  const segments = GENDER_SEGMENTS
    .map((s) => ({ ...s, count: breakdown[s.key] }))
    .filter((s) => s.count > 0);

  return (
    <Panel className="p-6">
      <div className="mb-4">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
          Gender Composition
        </span>
        <p className="text-sm text-muted-foreground">Board diversity breakdown</p>
      </div>
      <div className="flex h-4 rounded-[6px] overflow-hidden mb-4">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className={`${segment.colour} transition-all`}
            style={{ width: `${(segment.count / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-[2px] ${segment.colour}`} />
            <span className="text-sm">
              {segment.label}: {segment.count} ({Math.round((segment.count / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function MemberCard({
  member,
  onEdit,
  onDelete,
}: {
  member: BoardMember;
  onEdit?: (member: BoardMember) => void;
  onDelete?: (member: BoardMember) => void;
}) {
  const roleLabels: Record<string, string> = {
    chair: 'Chair',
    vice_chair: 'Vice Chair',
    director: 'Director',
    secretary: 'Secretary',
    treasurer: 'Treasurer',
  };

  return (
    <Panel className="p-4 group">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-full border border-studio-hairline bg-studio-paper flex items-center justify-center shrink-0">
          <User className="h-5 w-5 text-studio-dim" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium">{member.member_name}</h3>
              {member.is_independent && (
                <StateChip tone="good">Independent</StateChip>
              )}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onEdit(member)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-studio-stale hover:text-studio-stale hover:bg-studio-stale/10"
                  onClick={() => onDelete(member)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {roleLabels[member.role] || member.role}
          </p>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <StateChip tone="quiet">{member.member_type.replace('_', ' ')}</StateChip>
            {member.committee_memberships && member.committee_memberships.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Committees: {member.committee_memberships.join(', ')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            {member.appointment_date && (
              <span>Since {new Date(member.appointment_date).toLocaleDateString()}</span>
            )}
            {member.meeting_attendance_rate !== null && (
              <span className={member.meeting_attendance_rate >= 75 ? 'text-studio-good' : 'text-studio-attention'}>
                {Math.round(member.meeting_attendance_rate)}% attendance
              </span>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function BoardCompositionChart({
  members,
  metrics,
  isLoading,
  onEditMember,
  onDeleteMember,
}: BoardCompositionChartProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-40" />
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  const currentMembers = members.filter(m => m.is_current);

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Board Members"
          value={metrics.total_members}
          icon={Users}
        />
        <MetricCard
          title="Independent"
          value={`${Math.round(metrics.independence_ratio * 100)}%`}
          target=">50%"
          isGood={metrics.independence_ratio >= 0.5}
          icon={CheckCircle}
        />
        <MetricCard
          title="Gender Balance"
          value={`${Math.round(metrics.gender_diversity_ratio * 100)}%`}
          target="40-60%"
          isGood={metrics.gender_diversity_ratio >= 0.4}
          icon={Users}
        />
        <MetricCard
          title="Avg Attendance"
          value={`${Math.round(metrics.average_attendance)}%`}
          target=">75%"
          isGood={metrics.average_attendance >= 75}
          icon={Calendar}
        />
      </div>

      {/* Gender Breakdown */}
      <GenderBreakdownChart breakdown={metrics.gender_breakdown} />

      {/* Composition Breakdown */}
      <Panel className="p-6">
        <div className="mb-4">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
            Board Type Composition
          </span>
        </div>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Executive Directors</span>
              <span className="font-medium">{metrics.executive_count}</span>
            </div>
            <Progress
              value={metrics.total_members > 0 ? (metrics.executive_count / metrics.total_members) * 100 : 0}
              indicatorClassName="bg-studio-ink"
              className="h-2"
            />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Non-Executive Directors</span>
              <span className="font-medium">{metrics.non_executive_count}</span>
            </div>
            <Progress
              value={metrics.total_members > 0 ? (metrics.non_executive_count / metrics.total_members) * 100 : 0}
              indicatorClassName="bg-studio-ink"
              className="h-2"
            />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Independent Directors</span>
              <span className="font-medium">{metrics.independent_count}</span>
            </div>
            <Progress
              value={metrics.total_members > 0 ? (metrics.independent_count / metrics.total_members) * 100 : 0}
              indicatorClassName="bg-studio-ink"
              className="h-2"
            />
          </div>
        </div>
      </Panel>

      {/* Terms Expiring Soon */}
      {metrics.terms_expiring_soon > 0 && (
        <Panel className="p-4 border-studio-attention/40 bg-studio-attention/5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-studio-attention" />
            <div>
              <p className="font-medium">
                {metrics.terms_expiring_soon} board term{metrics.terms_expiring_soon !== 1 ? 's' : ''} expiring soon
              </p>
              <p className="text-sm text-muted-foreground">
                Review appointments to ensure continuity
              </p>
            </div>
          </div>
        </Panel>
      )}

      {/* Board Members List */}
      {currentMembers.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Current Board Members</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentMembers.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                onEdit={onEditMember}
                onDelete={onDeleteMember}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {members.length === 0 && (
        <Panel className="p-8 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium text-lg">No board members yet</h3>
          <p className="text-muted-foreground mt-1">
            Add board members to track composition and diversity
          </p>
        </Panel>
      )}
    </div>
  );
}
