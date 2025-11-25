import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp } from 'lucide-react';
import { ScopeBreakdown } from '@/hooks/data/useCompanyMetrics';

interface CarbonDeepDiveProps {
  scopeBreakdown: ScopeBreakdown | null;
  totalCO2: number;
}

export function CarbonDeepDive({ scopeBreakdown, totalCO2 }: CarbonDeepDiveProps) {
  if (!scopeBreakdown) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No carbon breakdown data available
        </CardContent>
      </Card>
    );
  }

  const scopes = [
    {
      name: 'Scope 1',
      label: 'Direct Emissions',
      value: scopeBreakdown.scope1,
      color: 'bg-red-500',
      textColor: 'text-red-700',
      bgColor: 'bg-red-50',
      description: 'Stationary & mobile combustion, process emissions',
    },
    {
      name: 'Scope 2',
      label: 'Indirect Energy',
      value: scopeBreakdown.scope2,
      color: 'bg-orange-500',
      textColor: 'text-orange-700',
      bgColor: 'bg-orange-50',
      description: 'Purchased electricity, heat, steam, cooling',
    },
    {
      name: 'Scope 3',
      label: 'Value Chain',
      value: scopeBreakdown.scope3,
      color: 'bg-amber-500',
      textColor: 'text-amber-700',
      bgColor: 'bg-amber-50',
      description: 'Purchased goods, transportation, waste',
    },
  ];

  const maxValue = Math.max(scopeBreakdown.scope1, scopeBreakdown.scope2, scopeBreakdown.scope3);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Carbon Footprint Breakdown
              </CardTitle>
              <CardDescription>
                GHG Protocol Scope 1, 2, 3 emissions waterfall
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              GHG Protocol
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            {scopes.map((scope) => {
              const percentage = totalCO2 > 0 ? (scope.value / totalCO2) * 100 : 0;
              return (
                <Card key={scope.name} className={`border-2 ${scope.bgColor}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${scope.textColor} uppercase tracking-wide`}>
                        {scope.name}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {percentage.toFixed(1)}%
                      </Badge>
                    </div>
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {scope.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold">
                        {scope.value.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                      </span>
                      <span className="text-sm text-muted-foreground">kg CO₂eq</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {scope.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Visual Breakdown</span>
              <span className="text-muted-foreground">
                Total: {totalCO2.toLocaleString('en-GB', { maximumFractionDigits: 0 })} kg CO₂eq
              </span>
            </div>

            {scopes.map((scope) => {
              const percentage = totalCO2 > 0 ? (scope.value / totalCO2) * 100 : 0;
              const barWidth = maxValue > 0 ? (scope.value / maxValue) * 100 : 0;

              return (
                <div key={scope.name} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className={`font-medium ${scope.textColor}`}>{scope.name}</span>
                    <span className="text-muted-foreground">
                      {scope.value.toLocaleString('en-GB', { maximumFractionDigits: 0 })} kg ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-8 w-full bg-gray-100 rounded-lg overflow-hidden">
                    <div
                      className={`h-full ${scope.color} transition-all duration-500 flex items-center justify-end pr-3`}
                      style={{ width: `${barWidth}%` }}
                    >
                      {barWidth > 15 && (
                        <span className="text-white text-xs font-semibold">
                          {percentage.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4 flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-blue-900">
                  Focus Area: Scope 3 Value Chain
                </p>
                <p className="text-xs text-muted-foreground">
                  Scope 3 typically represents 70-90% of total emissions for most companies. Prioritise supplier engagement and product LCAs for maximum impact.
                </p>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
