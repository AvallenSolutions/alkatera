import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, ChevronRight, ArrowLeft, FileText } from 'lucide-react';
import { ScopeBreakdown } from '@/hooks/data/useCompanyMetrics';
import { CategoryDetailsSheet } from './CategoryDetailsSheet';

interface CarbonDeepDiveProps {
  scopeBreakdown: ScopeBreakdown | null;
  totalCO2: number;
}

interface CategoryDetail {
  name: string;
  value: number;
  unit: string;
  categoryId: string;
  hasEvidence: boolean;
}

interface ScopeDetail {
  name: string;
  label: string;
  color: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  description: string;
  scopeNumber: number;
  categories: CategoryDetail[];
}

interface EvidenceItem {
  id: string;
  name: string;
  detail: string;
  quantity: number;
  unit: string;
  emissionFactor: number;
  totalImpact: number;
}

export function CarbonDeepDive({ scopeBreakdown, totalCO2 }: CarbonDeepDiveProps) {
  const [selectedScope, setSelectedScope] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryDetail | null>(null);
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([]);

  if (!scopeBreakdown) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No carbon breakdown data available
        </CardContent>
      </Card>
    );
  }

  const scopes: ScopeDetail[] = [
    {
      name: 'Scope 1',
      label: 'Direct Emissions',
      color: 'bg-red-500',
      textColor: 'text-red-700',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      description: 'Stationary & mobile combustion, process emissions',
      scopeNumber: 1,
      categories: [
        { name: 'Stationary Combustion', value: 1250.50, unit: 'Natural gas, boilers', categoryId: 'stationary', hasEvidence: false },
        { name: 'Mobile Combustion', value: 850.30, unit: 'Company vehicles, diesel', categoryId: 'mobile', hasEvidence: false },
        { name: 'Fugitive Emissions', value: 320.75, unit: 'Refrigerants, leaks', categoryId: 'fugitive', hasEvidence: false },
      ],
    },
    {
      name: 'Scope 2',
      label: 'Indirect Energy',
      color: 'bg-orange-500',
      textColor: 'text-orange-700',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      description: 'Purchased electricity, heat, steam, cooling',
      scopeNumber: 2,
      categories: [
        { name: 'Purchased Electricity', value: 3450.80, unit: 'Grid mix, 18,000 kWh', categoryId: 'electricity', hasEvidence: false },
        { name: 'Purchased Heat', value: 680.20, unit: 'District heating', categoryId: 'heat', hasEvidence: false },
      ],
    },
    {
      name: 'Scope 3',
      label: 'Value Chain',
      color: 'bg-amber-500',
      textColor: 'text-amber-700',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      description: 'Purchased goods, transportation, waste',
      scopeNumber: 3,
      categories: [
        { name: 'Purchased Goods & Services', value: 21251.00, unit: 'Raw materials, packaging', categoryId: 'purchased_goods', hasEvidence: true },
        { name: 'Upstream Transportation', value: 2340.90, unit: 'Freight, logistics', categoryId: 'upstream_transport', hasEvidence: true },
        { name: 'Employee Commuting', value: 1250.70, unit: 'Daily commute', categoryId: 'commuting', hasEvidence: false },
        { name: 'Business Travel', value: 890.50, unit: 'Flights, hotels', categoryId: 'business_travel', hasEvidence: true },
        { name: 'Waste Generated', value: 540.30, unit: 'Operational waste', categoryId: 'waste', hasEvidence: false },
      ],
    },
  ];

  // Calculate scope values from categories (data integrity: whole = sum of parts)
  const scopeValues = scopes.map(scope => ({
    ...scope,
    value: scope.categories.reduce((sum, cat) => sum + cat.value, 0)
  }));

  const totalOperationalCO2 = scopeValues.reduce((sum, scope) => sum + scope.value, 0);
  const maxValue = Math.max(...scopeValues.map(s => s.value));

  const handleCategoryClick = async (category: CategoryDetail) => {
    setSelectedCategory(category);

    // Mock evidence data - in production, this would fetch from database
    const mockEvidence: EvidenceItem[] = [];

    if (category.categoryId === 'purchased_goods') {
      mockEvidence.push(
        { id: '1', name: 'Glass Bottles', detail: 'Supplier A (UK)', quantity: 50000, unit: 'units', emissionFactor: 0.285, totalImpact: 14250 },
        { id: '2', name: 'Aluminium Cans', detail: 'Supplier B (ES)', quantity: 30000, unit: 'units', emissionFactor: 0.195, totalImpact: 5850 },
        { id: '3', name: 'Cardboard Packaging', detail: 'Supplier C (DE)', quantity: 5000, unit: 'kg', emissionFactor: 0.95, totalImpact: 4750 }
      );
    } else if (category.categoryId === 'business_travel') {
      mockEvidence.push(
        { id: '1', name: 'London → Barcelona', detail: 'Flight, Economy', quantity: 1150, unit: 'km', emissionFactor: 0.255, totalImpact: 293.25 },
        { id: '2', name: 'Barcelona → Dublin', detail: 'Flight, Economy', quantity: 1460, unit: 'km', emissionFactor: 0.255, totalImpact: 372.30 },
        { id: '3', name: 'Dublin → London', detail: 'Flight, Economy', quantity: 465, unit: 'km', emissionFactor: 0.255, totalImpact: 118.58 }
      );
    } else if (category.categoryId === 'upstream_transport') {
      mockEvidence.push(
        { id: '1', name: 'Supplier A → London', detail: 'HGV, Diesel', quantity: 2500, unit: 'tkm', emissionFactor: 0.62, totalImpact: 1550 },
        { id: '2', name: 'Supplier B → Barcelona', detail: 'HGV, Diesel', quantity: 1800, unit: 'tkm', emissionFactor: 0.62, totalImpact: 1116 }
      );
    }

    setEvidenceItems(mockEvidence);
  };

  if (selectedScope !== null) {
    const scopeData = scopeValues.find(s => s.scopeNumber === selectedScope);
    if (!scopeData) return null;

    return (
      <>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-4">
                <Button
                  variant="default"
                  size="lg"
                  onClick={() => setSelectedScope(null)}
                  className="gap-2"
                >
                  <ArrowLeft className="h-5 w-5" />
                  Back to Overview
                </Button>
              </div>
            <div className="flex items-center justify-between mt-4">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  {scopeData.name} Breakdown
                </CardTitle>
                <CardDescription>{scopeData.description}</CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                GHG Protocol
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Card className={`${scopeData.bgColor} border-2 ${scopeData.borderColor}`}>
              <CardContent className="p-6">
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-bold">
                    {scopeData.value.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                  </span>
                  <span className="text-xl text-muted-foreground">kg CO₂eq</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {((scopeData.value / totalOperationalCO2) * 100).toFixed(3)}% of total operational emissions
                </p>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Category Breakdown</h3>
                <Badge variant="outline" className="text-xs">
                  Click rows with evidence to view audit trail
                </Badge>
              </div>
              {scopeData.categories.map((category, idx) => {
                const percentage = scopeData.value > 0 ? (category.value / scopeData.value) * 100 : 0;
                const barWidth = scopeData.value > 0 ? (category.value / scopeData.value) * 100 : 0;

                return (
                  <Card
                    key={idx}
                    className={`border-2 ${category.hasEvidence ? 'cursor-pointer hover:bg-gray-50 hover:shadow-md' : ''} transition-all`}
                    onClick={() => category.hasEvidence && handleCategoryClick(category)}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{category.name}</span>
                              {category.hasEvidence && (
                                <Badge variant="secondary" className="text-xs">
                                  <FileText className="h-3 w-3 mr-1" />
                                  Evidence
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{category.unit}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="font-bold">
                                {category.value.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg
                              </div>
                              <Badge variant="outline" className="text-xs mt-1">
                                {percentage.toFixed(3)}%
                              </Badge>
                            </div>
                            {category.hasEvidence && (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${scopeData.color} transition-all duration-500`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <CategoryDetailsSheet
        open={selectedCategory !== null}
        onOpenChange={(open) => !open && setSelectedCategory(null)}
        categoryName={selectedCategory?.name || ''}
        categoryId={selectedCategory?.categoryId || ''}
        evidenceItems={evidenceItems}
        totalImpact={selectedCategory?.value || 0}
      />
    </>
    );
  }

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
            {scopeValues.map((scope) => {
              const percentage = totalOperationalCO2 > 0 ? (scope.value / totalOperationalCO2) * 100 : 0;
              return (
                <Card
                  key={scope.name}
                  className={`border-2 ${scope.bgColor} ${scope.borderColor} cursor-pointer hover:shadow-lg transition-shadow`}
                  onClick={() => setSelectedScope(scope.scopeNumber)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${scope.textColor} uppercase tracking-wide`}>
                        {scope.name}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {percentage.toFixed(3)}%
                      </Badge>
                    </div>
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {scope.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold">
                        {scope.value.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                      </span>
                      <span className="text-sm text-muted-foreground">kg CO₂eq</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {scope.description}
                    </p>
                    <Button variant="ghost" size="sm" className="w-full gap-2 text-xs">
                      View Details
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Visual Breakdown</span>
              <span className="text-muted-foreground">
                Total: {totalOperationalCO2.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg CO₂eq
              </span>
            </div>

            {scopeValues.map((scope) => {
              const percentage = totalOperationalCO2 > 0 ? (scope.value / totalOperationalCO2) * 100 : 0;
              const barWidth = maxValue > 0 ? (scope.value / maxValue) * 100 : 0;

              return (
                <div key={scope.name} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className={`font-medium ${scope.textColor}`}>{scope.name}</span>
                    <span className="text-muted-foreground">
                      {scope.value.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg ({percentage.toFixed(3)}%)
                    </span>
                  </div>
                  <div className="h-8 w-full bg-gray-100 rounded-lg overflow-hidden">
                    <div
                      className={`h-full ${scope.color} transition-all duration-500 flex items-center justify-end pr-3`}
                      style={{ width: `${barWidth}%` }}
                    >
                      {barWidth > 15 && (
                        <span className="text-white text-xs font-semibold">
                          {percentage.toFixed(3)}%
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
                  Scope 3 typically represents 70-90% of total emissions for most companies. Prioritise supplier engagement and product LCAs for maximum impact. Click any scope card above to see detailed category breakdown.
                </p>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
