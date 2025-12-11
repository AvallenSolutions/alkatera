import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mountain, Leaf, Droplets, Wind } from 'lucide-react';
import { NatureMetrics } from '@/hooks/data/useCompanyMetrics';

interface NatureDeepDiveProps {
  natureMetrics: NatureMetrics | null;
}

export function NatureDeepDive({ natureMetrics }: NatureDeepDiveProps) {
  const metrics = [
    {
      name: 'Land Use',
      value: natureMetrics?.land_use || 0,
      unit: 'm²a crop eq',
      icon: Mountain,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      description: 'Land occupation and transformation impact',
      maxValue: 10000,
      interpretation: 'Lower is better - less land transformed',
      targetGuidance: 'Good: <500 | Fair: 500-2000 | High: >2000',
    },
    {
      name: 'Terrestrial Ecotoxicity',
      value: natureMetrics?.terrestrial_ecotoxicity || 0,
      unit: 'kg 1,4-DCB',
      icon: Leaf,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
      description: 'Toxic impact on terrestrial ecosystems',
      maxValue: 100,
      interpretation: 'Lower is better - less toxic impact',
      targetGuidance: 'Good: <5 | Fair: 5-15 | High: >15',
    },
    {
      name: 'Freshwater Eutrophication',
      value: natureMetrics?.freshwater_eutrophication || 0,
      unit: 'kg P eq',
      icon: Droplets,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      description: 'Nutrient loading in freshwater bodies',
      maxValue: 10,
      interpretation: 'Lower is better - less water pollution',
      targetGuidance: 'Good: <0.3 | Fair: 0.3-0.7 | High: >0.7',
    },
    {
      name: 'Terrestrial Acidification',
      value: natureMetrics?.terrestrial_acidification || 0,
      unit: 'kg SO₂ eq',
      icon: Wind,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      description: 'Acidifying emissions affecting soil and plants',
      maxValue: 50,
      interpretation: 'Lower is better - less soil acidification',
      targetGuidance: 'Good: <1.5 | Fair: 1.5-3.0 | High: >3.0',
    },
  ];

  const maxMetricValue = Math.max(...metrics.map(m => (m.value / m.maxValue) * 100));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Mountain className="h-5 w-5" />
                Nature Impact Radar
              </CardTitle>
              <CardDescription>
                Multi-dimensional biodiversity & ecosystem assessment
              </CardDescription>
            </div>
            <div className="flex gap-1">
              <Badge variant="outline" className="text-xs">CSRD E4</Badge>
              <Badge variant="outline" className="text-xs">TNFD</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            {metrics.map((metric) => {
              const IconComponent = metric.icon;
              const percentageOfMax = metric.maxValue > 0 ? (metric.value / metric.maxValue) * 100 : 0;
              const relativeIntensity = maxMetricValue > 0 ? (percentageOfMax / maxMetricValue) * 100 : 0;

              const getTitleClass = () => {
                if (metric.name === 'Land Use') return 'text-green-900';
                if (metric.name === 'Terrestrial Ecotoxicity') return 'text-green-900';
                if (metric.name === 'Freshwater Eutrophication') return 'text-blue-900';
                if (metric.name === 'Terrestrial Acidification') return 'text-purple-900';
                return 'text-slate-900';
              };

              return (
                <Card key={metric.name} className={`border-2 ${metric.bgColor} border-opacity-30`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                        <IconComponent className={`h-4 w-4 ${metric.color}`} />
                      </div>
                      <CardTitle className={`text-sm ${getTitleClass()}`}>{metric.name}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold">
                        {metric.value.toLocaleString('en-GB', { maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-xs text-muted-foreground">{metric.unit}</span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground font-medium">{metric.interpretation}</span>
                        <Badge variant="outline" className="text-xs">Impact Level</Badge>
                      </div>
                      <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${metric.color.replace('text-', 'bg-')} transition-all duration-500`}
                          style={{ width: `${Math.min(relativeIntensity, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {metric.description}
                      </p>
                      <div className="pt-2 border-t">
                        <p className="text-xs font-medium text-muted-foreground">Benchmark:</p>
                        <p className="text-xs text-muted-foreground mt-1">{metric.targetGuidance}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="border-2 border-green-200 bg-green-50">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-green-900">
                  Nature-Positive Actions
                </h3>
                <Badge variant="outline" className="text-xs border-green-300 text-green-700">
                  ReCiPe 2016
                </Badge>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white border border-green-200">
                  <Mountain className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-green-900">Reduce Land Footprint</p>
                    <p className="text-xs text-muted-foreground">
                      Optimize sourcing from low-impact suppliers and prioritise regenerative agriculture
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-white border border-green-200">
                  <Leaf className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-green-900">Minimize Ecotoxicity</p>
                    <p className="text-xs text-muted-foreground">
                      Phase out harmful chemicals and support organic/sustainable farming practices
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-white border border-green-200">
                  <Droplets className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-green-900">Control Nutrient Loading</p>
                    <p className="text-xs text-muted-foreground">
                      Improve wastewater treatment and reduce agricultural runoff in supply chain
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-semibold text-blue-900">
                TNFD LEAP Approach
              </p>
              <p className="text-xs text-muted-foreground">
                These metrics support the Taskforce on Nature-related Financial Disclosures (TNFD) framework. Use this data to identify nature-related dependencies, impacts, risks, and opportunities across your value chain.
              </p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
