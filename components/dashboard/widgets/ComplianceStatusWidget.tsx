'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useCompanyMetrics } from '@/hooks/data/useCompanyMetrics';
import { ShieldCheck, CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface ComplianceItem {
  id: string;
  label: string;
  status: 'complete' | 'partial' | 'pending';
  description: string;
}

export function ComplianceStatusWidget() {
  const { metrics, loading, error } = useCompanyMetrics();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Compliance Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Compliance Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600 dark:text-red-400">Failed to load compliance data</p>
        </CardContent>
      </Card>
    );
  }

  const csrdPercentage = metrics?.csrd_compliant_percentage || 0;
  const productsAssessed = metrics?.total_products_assessed || 0;

  const complianceItems: ComplianceItem[] = [
    {
      id: 'scope-1-2',
      label: 'Scope 1 & 2 Emissions',
      status: productsAssessed > 0 ? 'complete' : 'pending',
      description: 'Direct and energy emissions',
    },
    {
      id: 'scope-3',
      label: 'Scope 3 Emissions',
      status: productsAssessed > 0 ? 'partial' : 'pending',
      description: 'Supply chain emissions',
    },
    {
      id: 'product-lcas',
      label: 'Product Environmental Impacts',
      status: csrdPercentage >= 100 ? 'complete' : csrdPercentage > 0 ? 'partial' : 'pending',
      description: 'Environmental impact assessments',
    },
    {
      id: 'data-quality',
      label: 'Data Quality',
      status: csrdPercentage >= 70 ? 'complete' : csrdPercentage >= 30 ? 'partial' : 'pending',
      description: 'Primary data coverage',
    },
  ];

  const completedCount = complianceItems.filter((i) => i.status === 'complete').length;
  const overallProgress = Math.round((completedCount / complianceItems.length) * 100);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          Compliance Status
        </CardTitle>
        <CardDescription>CSRD & regulatory readiness</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">CSRD Readiness</span>
            <Badge
              variant="outline"
              className={
                overallProgress >= 75
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : overallProgress >= 50
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
              }
            >
              {overallProgress}%
            </Badge>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>

        <div className="space-y-2">
          {complianceItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50"
            >
              {item.status === 'complete' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              ) : item.status === 'partial' ? (
                <div className="h-4 w-4 rounded-full border-2 border-amber-500 bg-amber-500/30 flex-shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-slate-400 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    item.status === 'complete'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : item.status === 'partial'
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-slate-500'
                  }`}
                >
                  {item.label}
                </p>
                <p className="text-xs text-muted-foreground truncate">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href="/reports/sustainability">
            View Compliance Details
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
