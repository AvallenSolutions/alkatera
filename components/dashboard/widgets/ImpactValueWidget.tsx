import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Lock } from 'lucide-react';
import Link from 'next/link';
import { useImpactValueWidget } from '@/hooks/data/useImpactValueWidget';

function ImpactValueSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-9 w-20" />
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-36" />
    </div>
  );
}

export function ImpactValueWidget() {
  const { state, totalValue, currency, missingDataAreas, isLoading } = useImpactValueWidget();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-slate-400" />
                </div>
                Impact Value
              </CardTitle>
            </div>
            <Badge variant="secondary">BETA</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ImpactValueSkeleton />
        </CardContent>
      </Card>
    );
  }

  // Locked state — user does not have beta access
  if (state === 'locked') {
    return (
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                Impact Value
              </CardTitle>
            </div>
            <Badge variant="secondary">BETA</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Unlock the commercial value of your sustainability data. Contact alka<strong>tera</strong> to enable this feature.
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/reports/impact-valuation?year=${new Date().getFullYear()}`}>Learn More</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Incomplete state — beta access but missing data areas
  if (state === 'incomplete') {
    return (
      <Card className="border-amber-200 dark:border-amber-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                Impact Value
              </CardTitle>
            </div>
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border-amber-200 dark:border-amber-800">
              BETA
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Your impact value is being calculated. Complete the missing data areas to see your full result.
          </p>
          {missingDataAreas.length > 0 && (
            <ul className="space-y-1.5 mb-4">
              {missingDataAreas.map((area) => (
                <li key={area} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                  {area}
                </li>
              ))}
            </ul>
          )}
          <Button variant="outline" size="sm" className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/50" asChild>
            <Link href={`/reports/impact-valuation?year=${new Date().getFullYear()}`}>Complete Data</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Active state — has calculated value (may still have missing data areas)
  return (
    <Card className="border-emerald-200 dark:border-emerald-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              Impact Value
            </CardTitle>
          </div>
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
            BETA
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold mb-1">
          {totalValue > 0
            ? totalValue.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })
            : 'Calculating\u2026'}
        </p>
        <p className="text-sm text-muted-foreground mb-3">
          Total monetised sustainability impact
        </p>
        {missingDataAreas.length > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
            Add {missingDataAreas.join(' & ')} data to improve accuracy
          </p>
        )}
        <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600" asChild>
          <Link href={`/reports/impact-valuation?year=${new Date().getFullYear()}`}>View Full Report</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
