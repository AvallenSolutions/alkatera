'use client';

import { Panel } from '@/components/studio/panel';
import { StateChip } from '@/components/studio/state-chip';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Briefcase,
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Coins,
  Scale,
  Pencil,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FairWorkMetrics, CompensationRecord, PayGapAnalysis, PayRatioAnalysis, LivingWageAnalysis } from '@/hooks/data/useFairWorkMetrics';

interface FairWorkDashboardProps {
  metrics: FairWorkMetrics | null;
  isLoading?: boolean;
  onEditRecord?: (record: CompensationRecord) => void;
  onDeleteRecord?: (record: CompensationRecord) => void;
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  status,
  className,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  status?: 'success' | 'warning' | 'error' | 'neutral';
  className?: string;
}) {
  const statusColors = {
    success: 'border-studio-good/40 bg-studio-good/5',
    warning: 'border-studio-attention/40 bg-studio-attention/5',
    error: 'border-studio-stale/40 bg-studio-stale/5',
    neutral: '',
  };

  return (
    <Panel className={cn(status && statusColors[status], className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          {trend && (
            <div className={cn(
              'flex items-center gap-1 text-xs mt-2',
              trend.value > 0 ? 'text-studio-good' : trend.value < 0 ? 'text-studio-stale' : 'text-muted-foreground'
            )}>
              {trend.value > 0 ? <TrendingUp className="h-3 w-3" /> : trend.value < 0 ? <TrendingDown className="h-3 w-3" /> : null}
              <span>{trend.label}</span>
            </div>
          )}
        </div>
        <div className="h-10 w-10 rounded-[6px] bg-studio-ink/[0.05] text-studio-dim flex items-center justify-center">
          {icon}
        </div>
      </div>
    </Panel>
  );
}

function LivingWageCard({ analysis }: { analysis: LivingWageAnalysis }) {
  const complianceStatus = analysis.percentage_compliant >= 100
    ? 'success'
    : analysis.percentage_compliant >= 80
    ? 'warning'
    : 'error';

  return (
    <Panel className="p-6">
      <div className="pb-4">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim flex items-center gap-2">
          <Coins className="h-4 w-4" />
          Living Wage Compliance
        </span>
        <p className="text-sm text-muted-foreground">Based on Living Wage Foundation benchmarks</p>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-3xl font-bold">{analysis.percentage_compliant.toFixed(1)}%</span>
          <StateChip
            tone={complianceStatus === 'success' ? 'good' : complianceStatus === 'warning' ? 'attention' : 'stale'}
            className="inline-flex items-center gap-1"
          >
            {complianceStatus === 'success' ? (
              <><CheckCircle2 className="h-3 w-3" /> Compliant</>
            ) : complianceStatus === 'warning' ? (
              <><AlertTriangle className="h-3 w-3" /> Partial</>
            ) : (
              <><AlertTriangle className="h-3 w-3" /> Action Needed</>
            )}
          </StateChip>
        </div>

        <Progress value={analysis.percentage_compliant} indicatorClassName="bg-studio-ink" className="h-2" />

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Above Living Wage</p>
            <p className="font-medium text-studio-good">{analysis.employees_above_living_wage}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Below Living Wage</p>
            <p className="font-medium text-studio-stale">{analysis.employees_below_living_wage}</p>
          </div>
        </div>

        {analysis.gap_to_compliance > 0 && (
          <div className="p-3 rounded-[6px] bg-studio-stale/5 text-sm">
            <p className="font-medium text-studio-stale">
              Gap to Full Compliance
            </p>
            <p className="text-studio-stale">
              £{analysis.gap_to_compliance.toLocaleString()} annual increase needed
            </p>
          </div>
        )}

        {analysis.by_location.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">By Location</p>
            {analysis.by_location.map((loc, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{loc.location}</span>
                <span>
                  <span className="text-studio-good">{loc.compliant}</span>
                  <span className="text-muted-foreground"> / </span>
                  <span>{loc.compliant + loc.non_compliant}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

function PayGapCard({ analysis }: { analysis: PayGapAnalysis }) {
  const meanGapStatus = Math.abs(analysis.mean_pay_gap) <= 5
    ? 'success'
    : Math.abs(analysis.mean_pay_gap) <= 15
    ? 'warning'
    : 'error';

  return (
    <Panel className="p-6">
      <div className="pb-4">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim flex items-center gap-2">
          <Scale className="h-4 w-4" />
          Gender Pay Gap
        </span>
        <p className="text-sm text-muted-foreground">UK Gender Pay Gap Reporting compliant</p>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 rounded-[6px] bg-studio-ink/[0.03]">
            <p className="text-xs text-muted-foreground uppercase">Mean Gap</p>
            <p className={cn(
              'text-2xl font-bold',
              meanGapStatus === 'success' ? 'text-studio-good' :
              meanGapStatus === 'warning' ? 'text-studio-attention' : 'text-studio-stale'
            )}>
              {analysis.mean_pay_gap.toFixed(1)}%
            </p>
          </div>
          <div className="text-center p-3 rounded-[6px] bg-studio-ink/[0.03]">
            <p className="text-xs text-muted-foreground uppercase">Median Gap</p>
            <p className="text-2xl font-bold">{analysis.median_pay_gap.toFixed(1)}%</p>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Male Employees</span>
            <span className="font-medium">{analysis.male_count}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Female Employees</span>
            <span className="font-medium">{analysis.female_count}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Mean Male Salary</span>
            <span className="font-medium">£{analysis.mean_male_salary.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Mean Female Salary</span>
            <span className="font-medium">£{analysis.mean_female_salary.toLocaleString()}</span>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          <p>A positive gap indicates men earn more on average. UK national average: ~14%.</p>
        </div>
      </div>
    </Panel>
  );
}

function PayRatioCard({ analysis }: { analysis: PayRatioAnalysis }) {
  return (
    <Panel className="p-6">
      <div className="pb-4">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim flex items-center gap-2">
          <Users className="h-4 w-4" />
          Pay Ratios
        </span>
        <p className="text-sm text-muted-foreground">Executive to worker compensation ratios</p>
      </div>
      <div className="space-y-4">
        <div className="text-center p-4 rounded-[6px] bg-studio-ink/[0.03]">
          <p className="text-xs text-muted-foreground uppercase">Highest to Median Ratio</p>
          <p className="text-3xl font-bold mt-1">
            {analysis.ceo_to_median_ratio ? `${analysis.ceo_to_median_ratio.toFixed(1)}:1` : '·'}
          </p>
          <div className="mt-2">
            <StateChip tone={analysis.b_corp_compliant ? 'good' : 'stale'}>
              {analysis.b_corp_compliant ? 'B Corp Aligned (≤10:1)' : 'Above B Corp Target'}
            </StateChip>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Highest Salary</p>
            <p className="font-medium">£{analysis.highest_salary.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Lowest Salary</p>
            <p className="font-medium">£{analysis.lowest_salary.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Median Salary</p>
            <p className="font-medium">£{analysis.median_salary.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Average Salary</p>
            <p className="font-medium">£{analysis.average_salary.toLocaleString()}</p>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          <p>B Corp recommends a ratio between 5:1 and 10:1 for certification.</p>
        </div>
      </div>
    </Panel>
  );
}

function CompensationRecordsTable({
  records,
  onEdit,
  onDelete,
}: {
  records: CompensationRecord[];
  onEdit?: (record: CompensationRecord) => void;
  onDelete?: (record: CompensationRecord) => void;
}) {
  if (records.length === 0) return null;

  const formatSalary = (value: number | null) =>
    value != null ? `£${value.toLocaleString()}` : '·';

  const formatRate = (value: number | null) =>
    value != null ? `£${value.toFixed(2)}/hr` : '·';

  const formatDate = (date: string) => {
    try {
      return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return date; }
  };

  const employmentTypeLabels: Record<string, string> = {
    full_time: 'Full Time',
    part_time: 'Part Time',
    contractor: 'Contractor',
    intern: 'Intern',
  };

  return (
    <Panel className="p-6">
      <div className="pb-4">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim flex items-center gap-2">
          <Users className="h-4 w-4" />
          Compensation Records
        </span>
        <p className="text-sm text-muted-foreground">Individual employee compensation data</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-studio-hairline text-left">
              <th className="pb-2 font-medium text-muted-foreground">Role</th>
              <th className="pb-2 font-medium text-muted-foreground">Department</th>
              <th className="pb-2 font-medium text-muted-foreground">Type</th>
              <th className="pb-2 font-medium text-muted-foreground text-right">Annual Salary</th>
              <th className="pb-2 font-medium text-muted-foreground text-right">Hourly Rate</th>
              <th className="pb-2 font-medium text-muted-foreground">Gender</th>
              <th className="pb-2 font-medium text-muted-foreground">Effective Date</th>
              {(onEdit || onDelete) && (
                <th className="pb-2 font-medium text-muted-foreground text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id} className="border-b border-studio-hairline last:border-0 hover:bg-muted/50">
                <td className="py-3">
                  <div>
                    <p className="font-medium">{record.role_title || '·'}</p>
                    {record.role_level && (
                      <p className="text-xs text-muted-foreground capitalize">{record.role_level.replace('_', ' ')}</p>
                    )}
                  </div>
                </td>
                <td className="py-3 text-muted-foreground">{record.department || '·'}</td>
                <td className="py-3">
                  <StateChip tone="quiet">
                    {employmentTypeLabels[record.employment_type] || record.employment_type}
                  </StateChip>
                </td>
                <td className="py-3 text-right font-medium">{formatSalary(record.annual_salary)}</td>
                <td className="py-3 text-right text-muted-foreground">{formatRate(record.hourly_rate)}</td>
                <td className="py-3 text-muted-foreground capitalize">{record.gender?.replace('_', ' ') || '·'}</td>
                <td className="py-3 text-muted-foreground">{formatDate(record.effective_date)}</td>
                {(onEdit || onDelete) && (
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {onEdit && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(record)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-studio-stale hover:text-studio-stale hover:bg-studio-stale/10" onClick={() => onDelete(record)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function FairWorkDashboard({ metrics, isLoading, onEditRecord, onDeleteRecord }: FairWorkDashboardProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <Panel className="flex flex-col items-center justify-center py-12 text-center">
        <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-2">No Fair Work Data</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Add compensation records to see fair work analytics including living wage compliance,
          gender pay gap analysis, and pay ratios.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Records"
          value={metrics.total_records}
          subtitle="Compensation records"
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          title="Departments"
          value={metrics.departments.length}
          subtitle="With compensation data"
          icon={<Briefcase className="h-5 w-5" />}
        />
        <StatCard
          title="Living Wage Compliance"
          value={metrics.living_wage_analysis ? `${metrics.living_wage_analysis.percentage_compliant.toFixed(0)}%` : '·'}
          icon={<Coins className="h-5 w-5" />}
          status={
            metrics.living_wage_analysis
              ? metrics.living_wage_analysis.percentage_compliant >= 100
                ? 'success'
                : metrics.living_wage_analysis.percentage_compliant >= 80
                ? 'warning'
                : 'error'
              : 'neutral'
          }
        />
        <StatCard
          title="Gender Pay Gap"
          value={metrics.pay_gap_analysis ? `${metrics.pay_gap_analysis.mean_pay_gap.toFixed(1)}%` : '·'}
          subtitle="Mean gap"
          icon={<Scale className="h-5 w-5" />}
          status={
            metrics.pay_gap_analysis
              ? Math.abs(metrics.pay_gap_analysis.mean_pay_gap) <= 5
                ? 'success'
                : Math.abs(metrics.pay_gap_analysis.mean_pay_gap) <= 15
                ? 'warning'
                : 'error'
              : 'neutral'
          }
        />
      </div>

      {/* Detailed Analysis Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metrics.living_wage_analysis && (
          <LivingWageCard analysis={metrics.living_wage_analysis} />
        )}
        {metrics.pay_gap_analysis && (
          <PayGapCard analysis={metrics.pay_gap_analysis} />
        )}
        {metrics.pay_ratio_analysis && (
          <PayRatioCard analysis={metrics.pay_ratio_analysis} />
        )}
      </div>

      {/* Department Breakdown */}
      {metrics.departments.length > 0 && (
        <Panel className="p-6">
          <div className="pb-4">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
              By Department
            </span>
          </div>
          <div className="space-y-3">
            {Object.entries(metrics.by_department).map(([dept, data]) => (
              <div key={dept} className="flex items-center justify-between p-3 rounded-[6px] bg-studio-ink/[0.03]">
                <div>
                  <p className="font-medium">{dept}</p>
                  <p className="text-sm text-muted-foreground">{data.count} employees</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">£{data.avg_salary.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">avg salary</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Individual Compensation Records */}
      {metrics.compensation_records.length > 0 && (
        <CompensationRecordsTable
          records={metrics.compensation_records}
          onEdit={onEditRecord}
          onDelete={onDeleteRecord}
        />
      )}
    </div>
  );
}

export { StatCard, LivingWageCard, PayGapCard, PayRatioCard };
