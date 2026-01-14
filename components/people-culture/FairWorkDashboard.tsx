'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Briefcase,
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Coins,
  Scale,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FairWorkMetrics, PayGapAnalysis, PayRatioAnalysis, LivingWageAnalysis } from '@/hooks/data/useFairWorkMetrics';

interface FairWorkDashboardProps {
  metrics: FairWorkMetrics | null;
  isLoading?: boolean;
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
    success: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30',
    warning: 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30',
    error: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30',
    neutral: '',
  };

  return (
    <Card className={cn(status && statusColors[status], className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
            {trend && (
              <div className={cn(
                'flex items-center gap-1 text-xs mt-2',
                trend.value > 0 ? 'text-emerald-600' : trend.value < 0 ? 'text-red-600' : 'text-muted-foreground'
              )}>
                {trend.value > 0 ? <TrendingUp className="h-3 w-3" /> : trend.value < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                <span>{trend.label}</span>
              </div>
            )}
          </div>
          <div className="h-10 w-10 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LivingWageCard({ analysis }: { analysis: LivingWageAnalysis }) {
  const complianceStatus = analysis.percentage_compliant >= 100
    ? 'success'
    : analysis.percentage_compliant >= 80
    ? 'warning'
    : 'error';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Coins className="h-4 w-4 text-emerald-600" />
          Living Wage Compliance
        </CardTitle>
        <CardDescription>Based on Living Wage Foundation benchmarks</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-3xl font-bold">{analysis.percentage_compliant.toFixed(1)}%</span>
            <Badge variant={complianceStatus === 'success' ? 'default' : complianceStatus === 'warning' ? 'secondary' : 'destructive'}>
              {complianceStatus === 'success' ? (
                <><CheckCircle2 className="h-3 w-3 mr-1" /> Compliant</>
              ) : complianceStatus === 'warning' ? (
                <><AlertTriangle className="h-3 w-3 mr-1" /> Partial</>
              ) : (
                <><AlertTriangle className="h-3 w-3 mr-1" /> Action Needed</>
              )}
            </Badge>
          </div>

          <Progress value={analysis.percentage_compliant} className="h-2" />

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Above Living Wage</p>
              <p className="font-medium text-emerald-600">{analysis.employees_above_living_wage}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Below Living Wage</p>
              <p className="font-medium text-red-600">{analysis.employees_below_living_wage}</p>
            </div>
          </div>

          {analysis.gap_to_compliance > 0 && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-sm">
              <p className="font-medium text-red-700 dark:text-red-400">
                Gap to Full Compliance
              </p>
              <p className="text-red-600 dark:text-red-300">
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
                    <span className="text-emerald-600">{loc.compliant}</span>
                    <span className="text-muted-foreground"> / </span>
                    <span>{loc.compliant + loc.non_compliant}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PayGapCard({ analysis }: { analysis: PayGapAnalysis }) {
  const meanGapStatus = Math.abs(analysis.mean_pay_gap) <= 5
    ? 'success'
    : Math.abs(analysis.mean_pay_gap) <= 15
    ? 'warning'
    : 'error';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Scale className="h-4 w-4 text-purple-600" />
          Gender Pay Gap
        </CardTitle>
        <CardDescription>UK Gender Pay Gap Reporting compliant</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
              <p className="text-xs text-muted-foreground uppercase">Mean Gap</p>
              <p className={cn(
                'text-2xl font-bold',
                meanGapStatus === 'success' ? 'text-emerald-600' :
                meanGapStatus === 'warning' ? 'text-yellow-600' : 'text-red-600'
              )}>
                {analysis.mean_pay_gap.toFixed(1)}%
              </p>
            </div>
            <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
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
      </CardContent>
    </Card>
  );
}

function PayRatioCard({ analysis }: { analysis: PayRatioAnalysis }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-600" />
          Pay Ratios
        </CardTitle>
        <CardDescription>Executive to worker compensation ratios</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
            <p className="text-xs text-muted-foreground uppercase">Highest to Median Ratio</p>
            <p className="text-3xl font-bold mt-1">
              {analysis.ceo_to_median_ratio ? `${analysis.ceo_to_median_ratio.toFixed(1)}:1` : '—'}
            </p>
            <Badge
              variant={analysis.b_corp_compliant ? 'default' : 'destructive'}
              className="mt-2"
            >
              {analysis.b_corp_compliant ? 'B Corp Aligned (≤10:1)' : 'Above B Corp Target'}
            </Badge>
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
      </CardContent>
    </Card>
  );
}

export function FairWorkDashboard({ metrics, isLoading }: FairWorkDashboardProps) {
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
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No Fair Work Data</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Add compensation records to see fair work analytics including living wage compliance,
            gender pay gap analysis, and pay ratios.
          </p>
        </CardContent>
      </Card>
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
          icon={<Users className="h-5 w-5 text-blue-600" />}
        />
        <StatCard
          title="Departments"
          value={metrics.departments.length}
          subtitle="With compensation data"
          icon={<Briefcase className="h-5 w-5 text-purple-600" />}
        />
        <StatCard
          title="Living Wage Compliance"
          value={metrics.living_wage_analysis ? `${metrics.living_wage_analysis.percentage_compliant.toFixed(0)}%` : '—'}
          icon={<Coins className="h-5 w-5 text-emerald-600" />}
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
          value={metrics.pay_gap_analysis ? `${metrics.pay_gap_analysis.mean_pay_gap.toFixed(1)}%` : '—'}
          subtitle="Mean gap"
          icon={<Scale className="h-5 w-5 text-pink-600" />}
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Department</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(metrics.by_department).map(([dept, data]) => (
                <div key={dept} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export { StatCard, LivingWageCard, PayGapCard, PayRatioCard };
