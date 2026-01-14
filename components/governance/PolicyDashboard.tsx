'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Policy, PolicyMetrics } from '@/hooks/data/usePolicies';
import { formatDistanceToNow } from 'date-fns';

interface PolicyDashboardProps {
  policies: Policy[];
  metrics: PolicyMetrics;
  isLoading?: boolean;
  onEditPolicy?: (policy: Policy) => void;
}

function MetricCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PolicyCard({ policy, onEdit }: { policy: Policy; onEdit?: (policy: Policy) => void }) {
  const statusColors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    under_review: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    archived: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };

  const typeLabels: Record<string, string> = {
    ethics: 'Ethics',
    environmental: 'Environmental',
    social: 'Social',
    governance: 'Governance',
    compliance: 'Compliance',
  };

  const isReviewOverdue = policy.review_date && new Date(policy.review_date) < new Date();

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium truncate">{policy.policy_name}</h3>
              {policy.policy_code && (
                <span className="text-xs text-muted-foreground">({policy.policy_code})</span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="outline" className={statusColors[policy.status]}>
                {policy.status.replace('_', ' ')}
              </Badge>
              <Badge variant="outline">
                {typeLabels[policy.policy_type] || policy.policy_type}
              </Badge>
              {policy.is_public ? (
                <Badge variant="outline" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  <Eye className="h-3 w-3 mr-1" />
                  Public
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  <EyeOff className="h-3 w-3 mr-1" />
                  Internal
                </Badge>
              )}
            </div>

            {policy.description && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                {policy.description}
              </p>
            )}

            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              {policy.owner_name && (
                <span>Owner: {policy.owner_name}</span>
              )}
              {policy.effective_date && (
                <span>Effective: {new Date(policy.effective_date).toLocaleDateString()}</span>
              )}
              {policy.review_date && (
                <span className={isReviewOverdue ? 'text-amber-600 font-medium' : ''}>
                  {isReviewOverdue ? (
                    <>
                      <AlertTriangle className="h-3 w-3 inline mr-1" />
                      Review overdue
                    </>
                  ) : (
                    `Review: ${new Date(policy.review_date).toLocaleDateString()}`
                  )}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {policy.public_url && (
              <Button variant="ghost" size="sm" asChild>
                <a href={policy.public_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
            {onEdit && (
              <Button variant="ghost" size="sm" onClick={() => onEdit(policy)}>
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PolicyDashboard({
  policies,
  metrics,
  isLoading,
  onEditPolicy,
}: PolicyDashboardProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const activePolicies = policies.filter(p => p.status === 'active');
  const draftPolicies = policies.filter(p => p.status === 'draft');

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Policies"
          value={metrics.total_policies}
          icon={FileText}
          color="blue"
        />
        <MetricCard
          title="Active"
          value={metrics.active_policies}
          icon={CheckCircle}
          color="emerald"
        />
        <MetricCard
          title="Due for Review"
          value={metrics.due_for_review}
          icon={AlertTriangle}
          color="amber"
        />
        <MetricCard
          title="Public"
          value={metrics.public_policies}
          icon={Eye}
          color="purple"
        />
      </div>

      {/* Policy Type Breakdown */}
      {Object.keys(metrics.by_type).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Policy Coverage</CardTitle>
            <CardDescription>Policies by type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(metrics.by_type).map(([type, count]) => (
                <Badge key={type} variant="secondary" className="text-sm">
                  {type.charAt(0).toUpperCase() + type.slice(1)}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Policies */}
      {activePolicies.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            Active Policies ({activePolicies.length})
          </h3>
          <div className="space-y-3">
            {activePolicies.map((policy) => (
              <PolicyCard key={policy.id} policy={policy} onEdit={onEditPolicy} />
            ))}
          </div>
        </div>
      )}

      {/* Draft Policies */}
      {draftPolicies.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-slate-600" />
            Draft Policies ({draftPolicies.length})
          </h3>
          <div className="space-y-3">
            {draftPolicies.map((policy) => (
              <PolicyCard key={policy.id} policy={policy} onEdit={onEditPolicy} />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {policies.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium text-lg">No policies yet</h3>
            <p className="text-muted-foreground mt-1">
              Add your first policy to track governance and compliance
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
