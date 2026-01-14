'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Users,
  User,
  CheckCircle,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import { BoardMember, BoardMetrics } from '@/hooks/data/useBoardComposition';

interface BoardCompositionChartProps {
  members: BoardMember[];
  metrics: BoardMetrics;
  isLoading?: boolean;
  onEditMember?: (member: BoardMember) => void;
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
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
            isGood === undefined ? 'bg-slate-100 dark:bg-slate-800 text-slate-600' :
            isGood ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' :
            'bg-amber-100 dark:bg-amber-900/30 text-amber-600'
          }`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {target && (
              <p className="text-xs text-muted-foreground">Target: {target}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GenderBreakdownChart({ breakdown }: { breakdown: BoardMetrics['gender_breakdown'] }) {
  const total = breakdown.male + breakdown.female + breakdown.other + breakdown.not_disclosed;
  if (total === 0) return null;

  const segments = [
    { label: 'Male', count: breakdown.male, color: 'bg-blue-500' },
    { label: 'Female', count: breakdown.female, color: 'bg-pink-500' },
    { label: 'Other', count: breakdown.other, color: 'bg-purple-500' },
    { label: 'Not Disclosed', count: breakdown.not_disclosed, color: 'bg-slate-400' },
  ].filter(s => s.count > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Gender Composition</CardTitle>
        <CardDescription>Board diversity breakdown</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex h-4 rounded-full overflow-hidden mb-4">
          {segments.map((segment) => (
            <div
              key={segment.label}
              className={`${segment.color} transition-all`}
              style={{ width: `${(segment.count / total) * 100}%` }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-4">
          {segments.map((segment) => (
            <div key={segment.label} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${segment.color}`} />
              <span className="text-sm">
                {segment.label}: {segment.count} ({Math.round((segment.count / total) * 100)}%)
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MemberCard({ member }: { member: BoardMember }) {
  const typeColors: Record<string, string> = {
    executive: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    non_executive: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    independent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  };

  const roleLabels: Record<string, string> = {
    chair: 'Chair',
    vice_chair: 'Vice Chair',
    director: 'Director',
    secretary: 'Secretary',
    treasurer: 'Treasurer',
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <User className="h-5 w-5 text-slate-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium">{member.member_name}</h3>
              {member.is_independent && (
                <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                  Independent
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {roleLabels[member.role] || member.role}
            </p>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="outline" className={typeColors[member.member_type]}>
                {member.member_type.replace('_', ' ')}
              </Badge>
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
                <span className={member.meeting_attendance_rate >= 75 ? 'text-emerald-600' : 'text-amber-600'}>
                  {Math.round(member.meeting_attendance_rate)}% attendance
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function BoardCompositionChart({
  members,
  metrics,
  isLoading,
  onEditMember,
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
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Board Type Composition</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Executive Directors</span>
                <span className="font-medium">{metrics.executive_count}</span>
              </div>
              <Progress
                value={metrics.total_members > 0 ? (metrics.executive_count / metrics.total_members) * 100 : 0}
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
                className="h-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Terms Expiring Soon */}
      {metrics.terms_expiring_soon > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium">
                  {metrics.terms_expiring_soon} board term{metrics.terms_expiring_soon !== 1 ? 's' : ''} expiring soon
                </p>
                <p className="text-sm text-muted-foreground">
                  Review appointments to ensure continuity
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Board Members List */}
      {currentMembers.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Current Board Members</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentMembers.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {members.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium text-lg">No board members yet</h3>
            <p className="text-muted-foreground mt-1">
              Add board members to track composition and diversity
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
