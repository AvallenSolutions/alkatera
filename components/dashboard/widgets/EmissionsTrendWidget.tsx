'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import { TrendingDown, TrendingUp, Minus, LineChart } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface MonthlyEmissions {
  month: string;
  emissions: number;
}

export function EmissionsTrendWidget() {
  const { currentOrganization } = useOrganization();
  const [data, setData] = useState<MonthlyEmissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trend, setTrend] = useState<number>(0);

  useEffect(() => {
    async function fetchEmissionsTrend() {
      if (!currentOrganization?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data: lcas, error: lcaError } = await supabase
          .from('product_carbon_footprints')
          .select('aggregated_impacts, created_at, updated_at')
          .eq('organization_id', currentOrganization.id)
          .eq('status', 'completed')
          .not('aggregated_impacts', 'is', null)
          .order('updated_at', { ascending: true });

        if (lcaError) throw lcaError;

        const monthlyData = new Map<string, number>();
        const months = [];
        const now = new Date();

        for (let i = 5; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
          months.push(key);
          monthlyData.set(key, 0);
        }

        lcas?.forEach((lca: any) => {
          const date = new Date(lca.updated_at);
          const key = date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
          const emissions = lca.aggregated_impacts?.climate_change_gwp100 || 0;

          if (monthlyData.has(key)) {
            monthlyData.set(key, (monthlyData.get(key) || 0) + emissions);
          }
        });

        let runningTotal = 0;
        const chartData: MonthlyEmissions[] = months.map((month) => {
          runningTotal += monthlyData.get(month) || 0;
          return { month, emissions: runningTotal };
        });

        setData(chartData);

        if (chartData.length >= 2) {
          const firstNonZero = chartData.find((d) => d.emissions > 0);
          const last = chartData[chartData.length - 1];
          if (firstNonZero && firstNonZero.emissions > 0) {
            const change = ((last.emissions - firstNonZero.emissions) / firstNonZero.emissions) * 100;
            setTrend(change);
          }
        }
      } catch (err: any) {
        console.error('Error fetching emissions trend:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchEmissionsTrend();
  }, [currentOrganization?.id]);

  if (loading) {
    return (
      <Card className="col-span-full lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-5 w-5" />
            Emissions Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="col-span-full lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-5 w-5" />
            Emissions Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = trend < 0 ? TrendingDown : trend > 0 ? TrendingUp : Minus;
  const hasData = data.some((d) => d.emissions > 0);

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <LineChart className="h-5 w-5 text-blue-500" />
              Emissions Trend
            </CardTitle>
            <CardDescription>Cumulative carbon footprint over 6 months</CardDescription>
          </div>
          {hasData && (
            <Badge
              variant="outline"
              className={
                trend < 0
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : trend > 0
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
              }
            >
              <TrendIcon className="h-3 w-3 mr-1" />
              {Math.abs(trend).toFixed(1)}%
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="emissionsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-slate-500"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value.toFixed(0)}`}
                  className="text-slate-500"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [`${value.toFixed(2)} tCO₂e`, 'Emissions']}
                />
                <Area
                  type="monotone"
                  dataKey="emissions"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#emissionsGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex flex-col items-center justify-center text-center">
            <LineChart className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-sm text-muted-foreground">
              Complete product LCAs to see your emissions trend
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
