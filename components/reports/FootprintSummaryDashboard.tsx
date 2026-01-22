'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  Factory,
  Truck,
  Plane,
  Package,
  Users,
  Trash2,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Info,
  Download,
  Calendar,
  TrendingDown,
  TrendingUp,
  ArrowUpFromLine,
  ArrowDownToLine,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Scope3Breakdown {
  products: number;
  business_travel: number;
  purchased_services: number;
  employee_commuting: number;
  capital_goods: number;
  downstream_logistics: number;
  operational_waste: number;
  marketing_materials: number;
  // New GHG Protocol categories
  upstream_transport?: number;    // Category 4: Upstream Transportation
  downstream_transport?: number;  // Category 9: Downstream Transportation
  use_phase?: number;             // Category 11: Use of Sold Products
}

interface FootprintSummaryDashboardProps {
  totalEmissions: number;
  scope1Emissions: number;
  scope2Emissions: number;
  scope3Emissions: number;
  scope3Breakdown?: Scope3Breakdown;
  operationsEmissions: number;
  fleetEmissions: number;
  year: number;
  lastUpdated?: string;
  status: string;
  onExport?: () => void;
}

interface CategoryItem {
  name: string;
  value: number;
  scope: 1 | 2 | 3;
  category?: string;
  icon: typeof Factory;
  color: string;
  dataQuality: 'complete' | 'partial' | 'missing';
}

export function FootprintSummaryDashboard({
  totalEmissions,
  scope1Emissions,
  scope2Emissions,
  scope3Emissions,
  scope3Breakdown,
  operationsEmissions,
  fleetEmissions,
  year,
  lastUpdated,
  status,
  onExport,
}: FootprintSummaryDashboardProps) {
  const [verificationOpen, setVerificationOpen] = useState(false);

  const formatEmissions = (value: number): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)} kt`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(3)} t`;
    }
    return `${value.toFixed(2)} kg`;
  };

  const formatPercentage = (value: number, total: number): string => {
    if (total === 0) return '0%';
    return `${((value / total) * 100).toFixed(1)}%`;
  };

  const categories: CategoryItem[] = useMemo(() => {
    const items: CategoryItem[] = [];

    if (scope1Emissions > 0) {
      items.push({
        name: 'Scope 1: Direct Emissions',
        value: scope1Emissions,
        scope: 1,
        icon: Factory,
        color: 'bg-orange-500',
        dataQuality: operationsEmissions > 0 ? 'complete' : 'missing',
      });
    }

    if (scope2Emissions > 0) {
      items.push({
        name: 'Scope 2: Purchased Energy',
        value: scope2Emissions,
        scope: 2,
        icon: Factory,
        color: 'bg-blue-500',
        dataQuality: operationsEmissions > 0 ? 'complete' : 'missing',
      });
    }

    if (scope3Breakdown) {
      if (scope3Breakdown.products > 0) {
        items.push({
          name: 'Cat 1: Purchased Goods',
          value: scope3Breakdown.products,
          scope: 3,
          category: 'Cat 1',
          icon: Package,
          color: 'bg-emerald-500',
          dataQuality: 'complete',
        });
      }
      if (scope3Breakdown.capital_goods > 0) {
        items.push({
          name: 'Cat 2: Capital Goods',
          value: scope3Breakdown.capital_goods,
          scope: 3,
          category: 'Cat 2',
          icon: DollarSign,
          color: 'bg-teal-500',
          dataQuality: 'partial',
        });
      }
      if (scope3Breakdown.operational_waste > 0) {
        items.push({
          name: 'Cat 5: Waste',
          value: scope3Breakdown.operational_waste,
          scope: 3,
          category: 'Cat 5',
          icon: Trash2,
          color: 'bg-amber-500',
          dataQuality: 'partial',
        });
      }
      if (scope3Breakdown.business_travel > 0) {
        items.push({
          name: 'Cat 6: Business Travel',
          value: scope3Breakdown.business_travel,
          scope: 3,
          category: 'Cat 6',
          icon: Plane,
          color: 'bg-sky-500',
          dataQuality: 'complete',
        });
      }
      if (scope3Breakdown.employee_commuting > 0) {
        items.push({
          name: 'Cat 7: Commuting',
          value: scope3Breakdown.employee_commuting,
          scope: 3,
          category: 'Cat 7',
          icon: Users,
          color: 'bg-indigo-500',
          dataQuality: 'partial',
        });
      }
      if (scope3Breakdown.downstream_logistics > 0) {
        items.push({
          name: 'Cat 9: Distribution',
          value: scope3Breakdown.downstream_logistics,
          scope: 3,
          category: 'Cat 9',
          icon: Truck,
          color: 'bg-fuchsia-500',
          dataQuality: 'partial',
        });
      }
      if (scope3Breakdown.purchased_services > 0) {
        items.push({
          name: 'Services & Other',
          value: scope3Breakdown.purchased_services,
          scope: 3,
          icon: DollarSign,
          color: 'bg-rose-500',
          dataQuality: 'partial',
        });
      }
      if (scope3Breakdown.marketing_materials > 0) {
        items.push({
          name: 'Marketing Materials',
          value: scope3Breakdown.marketing_materials,
          scope: 3,
          icon: Package,
          color: 'bg-pink-500',
          dataQuality: 'partial',
        });
      }
      // New GHG Protocol categories
      if (scope3Breakdown.upstream_transport && scope3Breakdown.upstream_transport > 0) {
        items.push({
          name: 'Cat 4: Upstream Transport',
          value: scope3Breakdown.upstream_transport,
          scope: 3,
          category: 'Cat 4',
          icon: ArrowUpFromLine,
          color: 'bg-violet-500',
          dataQuality: 'partial',
        });
      }
      if (scope3Breakdown.downstream_transport && scope3Breakdown.downstream_transport > 0) {
        items.push({
          name: 'Cat 9: Downstream Transport',
          value: scope3Breakdown.downstream_transport,
          scope: 3,
          category: 'Cat 9',
          icon: ArrowDownToLine,
          color: 'bg-purple-500',
          dataQuality: 'partial',
        });
      }
      if (scope3Breakdown.use_phase && scope3Breakdown.use_phase > 0) {
        items.push({
          name: 'Cat 11: Use of Products',
          value: scope3Breakdown.use_phase,
          scope: 3,
          category: 'Cat 11',
          icon: Zap,
          color: 'bg-yellow-500',
          dataQuality: 'partial',
        });
      }
    } else if (scope3Emissions > 0) {
      items.push({
        name: 'Scope 3: Value Chain',
        value: scope3Emissions,
        scope: 3,
        icon: Package,
        color: 'bg-green-500',
        dataQuality: 'partial',
      });
    }

    return items.sort((a, b) => b.value - a.value);
  }, [scope1Emissions, scope2Emissions, scope3Emissions, scope3Breakdown, operationsEmissions]);

  const dataCompletenessScore = useMemo(() => {
    const totalCategories = 13; // Updated to include new categories
    let completed = 0;
    if (operationsEmissions > 0) completed += 2;
    if (fleetEmissions > 0) completed += 1;
    if (scope3Breakdown?.products && scope3Breakdown.products > 0) completed += 1;
    if (scope3Breakdown?.business_travel && scope3Breakdown.business_travel > 0) completed += 1;
    if (scope3Breakdown?.employee_commuting && scope3Breakdown.employee_commuting > 0) completed += 1;
    if (scope3Breakdown?.capital_goods && scope3Breakdown.capital_goods > 0) completed += 1;
    if (scope3Breakdown?.downstream_logistics && scope3Breakdown.downstream_logistics > 0) completed += 1;
    if (scope3Breakdown?.operational_waste && scope3Breakdown.operational_waste > 0) completed += 1;
    if (scope3Breakdown?.purchased_services && scope3Breakdown.purchased_services > 0) completed += 1;
    // New categories
    if (scope3Breakdown?.upstream_transport && scope3Breakdown.upstream_transport > 0) completed += 1;
    if (scope3Breakdown?.downstream_transport && scope3Breakdown.downstream_transport > 0) completed += 1;
    if (scope3Breakdown?.use_phase && scope3Breakdown.use_phase > 0) completed += 1;
    return Math.round((completed / totalCategories) * 100);
  }, [operationsEmissions, fleetEmissions, scope3Breakdown]);

  const getDataQualityBadge = (quality: string) => {
    const config: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
      complete: { label: 'Complete', className: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle2 },
      partial: { label: 'Partial', className: 'bg-amber-100 text-amber-800 border-amber-300', icon: AlertCircle },
      missing: { label: 'Missing', className: 'bg-red-100 text-red-800 border-red-300', icon: AlertCircle },
    };
    const conf = config[quality] || config.partial;
    const Icon = conf.icon;
    return (
      <Badge variant="outline" className={cn('text-xs gap-1', conf.className)}>
        <Icon className="h-3 w-3" />
        {conf.label}
      </Badge>
    );
  };

  if (totalEmissions === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card className="border-2 border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-b border-slate-200 dark:border-slate-700">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <BarChart3 className="h-6 w-6 text-emerald-600" />
                  {year} Emissions Summary
                </CardTitle>
                <CardDescription className="mt-1">
                  Corporate carbon footprint calculated per GHG Protocol Corporate Standard
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-slate-900 dark:text-slate-100">
                  {formatEmissions(totalEmissions)} CO₂e
                </div>
                <div className="flex items-center justify-end gap-2 mt-1 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {lastUpdated
                    ? new Date(lastUpdated).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Not calculated'}
                </div>
              </div>
            </div>
          </CardHeader>
        </div>

        <CardContent className="pt-6">
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-orange-800 dark:text-orange-200">Scope 1</span>
                <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                  {formatPercentage(scope1Emissions, totalEmissions)}
                </Badge>
              </div>
              <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                {formatEmissions(scope1Emissions)}
              </div>
              <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">Direct emissions</p>
            </div>

            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Scope 2</span>
                <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                  {formatPercentage(scope2Emissions, totalEmissions)}
                </Badge>
              </div>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {formatEmissions(scope2Emissions)}
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">Purchased energy</p>
            </div>

            <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Scope 3</span>
                <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">
                  {formatPercentage(scope3Emissions, totalEmissions)}
                </Badge>
              </div>
              <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                {formatEmissions(scope3Emissions)}
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">Value chain</p>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Emissions by Category</span>
              <span className="text-xs text-muted-foreground">{categories.length} categories with data</span>
            </div>
            <div className="flex h-6 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
              {categories.map((cat, idx) => {
                const width = totalEmissions > 0 ? (cat.value / totalEmissions) * 100 : 0;
                if (width < 0.5) return null;
                return (
                  <div
                    key={idx}
                    className={cn('h-full transition-all hover:opacity-80', cat.color)}
                    style={{ width: `${width}%` }}
                    title={`${cat.name}: ${formatEmissions(cat.value)} (${width.toFixed(1)}%)`}
                  />
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            {categories.slice(0, 6).map((cat, idx) => {
              const percentage = totalEmissions > 0 ? (cat.value / totalEmissions) * 100 : 0;
              const Icon = cat.icon;
              return (
                <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <div className={cn('w-2 h-8 rounded', cat.color)} />
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {cat.name}
                  </span>
                  {getDataQualityBadge(cat.dataQuality)}
                  <span className="text-sm font-mono text-slate-700 dark:text-slate-300 w-24 text-right">
                    {formatEmissions(cat.value)}
                  </span>
                  <Badge variant="secondary" className="w-14 justify-center text-xs">
                    {percentage.toFixed(1)}%
                  </Badge>
                </div>
              );
            })}
            {categories.length > 6 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                + {categories.length - 6} more categories
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Data Completeness
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Overall Score</span>
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{dataCompletenessScore}%</span>
            </div>
            <Progress value={dataCompletenessScore} className="h-3" />
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-full', operationsEmissions > 0 ? 'bg-green-500' : 'bg-slate-300')} />
                <span className={operationsEmissions > 0 ? '' : 'text-muted-foreground'}>Operations</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-full', fleetEmissions > 0 ? 'bg-green-500' : 'bg-slate-300')} />
                <span className={fleetEmissions > 0 ? '' : 'text-muted-foreground'}>Fleet</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-full', (scope3Breakdown?.products || 0) > 0 ? 'bg-green-500' : 'bg-slate-300')} />
                <span className={(scope3Breakdown?.products || 0) > 0 ? '' : 'text-muted-foreground'}>Products</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-full', (scope3Breakdown?.business_travel || 0) > 0 ? 'bg-green-500' : 'bg-slate-300')} />
                <span className={(scope3Breakdown?.business_travel || 0) > 0 ? '' : 'text-muted-foreground'}>Travel</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-full', (scope3Breakdown?.employee_commuting || 0) > 0 ? 'bg-green-500' : 'bg-slate-300')} />
                <span className={(scope3Breakdown?.employee_commuting || 0) > 0 ? '' : 'text-muted-foreground'}>Commuting</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-full', (scope3Breakdown?.operational_waste || 0) > 0 ? 'bg-green-500' : 'bg-slate-300')} />
                <span className={(scope3Breakdown?.operational_waste || 0) > 0 ? '' : 'text-muted-foreground'}>Waste</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-600" />
              Methodology
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800">
              <span className="text-sm">Standard</span>
              <Badge variant="outline" className="border-green-500 text-green-700">GHG Protocol</Badge>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800">
              <span className="text-sm">Scope 1 & 2</span>
              <span className="text-sm text-muted-foreground">Activity-based</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800">
              <span className="text-sm">Scope 3 Categories</span>
              <span className="text-sm text-muted-foreground">Hybrid (activity + spend)</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800">
              <span className="text-sm">Emission Factors</span>
              <span className="text-sm text-muted-foreground">DEFRA 2025</span>
            </div>
            {onExport && (
              <Button variant="outline" className="w-full mt-2" onClick={onExport}>
                <Download className="h-4 w-4 mr-2" />
                Export Report Data
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Collapsible open={verificationOpen} onOpenChange={setVerificationOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-slate-600" />
                  Calculation Verification
                </CardTitle>
                {verificationOpen ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800">
                      <TableHead>Scope / Category</TableHead>
                      <TableHead>Data Source</TableHead>
                      <TableHead>Calculation Method</TableHead>
                      <TableHead className="text-right">Emissions (kg CO₂e)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Scope 1: Direct</TableCell>
                      <TableCell className="text-sm text-muted-foreground">calculated_emissions</TableCell>
                      <TableCell className="text-sm text-muted-foreground">Activity x DEFRA EF</TableCell>
                      <TableCell className="text-right font-mono">{scope1Emissions.toFixed(2)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Scope 2: Energy</TableCell>
                      <TableCell className="text-sm text-muted-foreground">calculated_emissions</TableCell>
                      <TableCell className="text-sm text-muted-foreground">kWh x Grid EF</TableCell>
                      <TableCell className="text-right font-mono">{scope2Emissions.toFixed(2)}</TableCell>
                    </TableRow>
                    {scope3Breakdown && (
                      <>
                        <TableRow className="bg-emerald-50/50 dark:bg-emerald-950/10">
                          <TableCell className="font-medium" colSpan={3}>Scope 3: Value Chain</TableCell>
                          <TableCell className="text-right font-mono font-semibold">{scope3Emissions.toFixed(2)}</TableCell>
                        </TableRow>
                        {scope3Breakdown.products > 0 && (
                          <TableRow>
                            <TableCell className="pl-6">Cat 1: Products</TableCell>
                            <TableCell className="text-sm text-muted-foreground">product_lcas + production_logs</TableCell>
                            <TableCell className="text-sm text-muted-foreground">LCA per unit x Volume</TableCell>
                            <TableCell className="text-right font-mono">{scope3Breakdown.products.toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                        {scope3Breakdown.capital_goods > 0 && (
                          <TableRow>
                            <TableCell className="pl-6">Cat 2: Capital Goods</TableCell>
                            <TableCell className="text-sm text-muted-foreground">corporate_overheads</TableCell>
                            <TableCell className="text-sm text-muted-foreground">Spend x EEIO EF</TableCell>
                            <TableCell className="text-right font-mono">{scope3Breakdown.capital_goods.toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                        {scope3Breakdown.business_travel > 0 && (
                          <TableRow>
                            <TableCell className="pl-6">Cat 6: Business Travel</TableCell>
                            <TableCell className="text-sm text-muted-foreground">corporate_overheads</TableCell>
                            <TableCell className="text-sm text-muted-foreground">Distance/Spend x DEFRA EF</TableCell>
                            <TableCell className="text-right font-mono">{scope3Breakdown.business_travel.toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                        {scope3Breakdown.employee_commuting > 0 && (
                          <TableRow>
                            <TableCell className="pl-6">Cat 7: Commuting</TableCell>
                            <TableCell className="text-sm text-muted-foreground">corporate_overheads</TableCell>
                            <TableCell className="text-sm text-muted-foreground">FTE x Avg Distance x DEFRA EF</TableCell>
                            <TableCell className="text-right font-mono">{scope3Breakdown.employee_commuting.toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                        {scope3Breakdown.downstream_logistics > 0 && (
                          <TableRow>
                            <TableCell className="pl-6">Cat 9: Distribution</TableCell>
                            <TableCell className="text-sm text-muted-foreground">corporate_overheads</TableCell>
                            <TableCell className="text-sm text-muted-foreground">tonne.km x DEFRA EF</TableCell>
                            <TableCell className="text-right font-mono">{scope3Breakdown.downstream_logistics.toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                        {scope3Breakdown.operational_waste > 0 && (
                          <TableRow>
                            <TableCell className="pl-6">Cat 5: Waste</TableCell>
                            <TableCell className="text-sm text-muted-foreground">corporate_overheads</TableCell>
                            <TableCell className="text-sm text-muted-foreground">kg x Disposal EF</TableCell>
                            <TableCell className="text-right font-mono">{scope3Breakdown.operational_waste.toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                      </>
                    )}
                    <TableRow className="bg-slate-100 dark:bg-slate-800 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right font-mono">{totalEmissions.toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                All calculations follow GHG Protocol Corporate Standard methodology. Emission factors sourced from
                DEFRA 2025 UK Government GHG Conversion Factors. Scope 3 Category 1 uses product-level LCA data
                where available, with spend-based estimation as fallback.
              </p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
