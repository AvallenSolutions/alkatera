"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Recycle,
  Trash2,
  Flame,
  Leaf,
  Factory,
  AlertTriangle,
  CheckCircle2,
  Info,
  TrendingUp,
  TrendingDown,
  Package,
  ArrowRight,
  Target,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Tooltip as RechartsTooltip,
} from 'recharts';
import type {
  WasteMetrics,
  WasteByCategoryItem,
  WasteByTreatmentItem,
  WasteByFacilityItem,
  CircularityTarget,
} from '@/hooks/data/useWasteMetrics';

interface WasteDeepDiveProps {
  wasteMetrics: WasteMetrics | null;
  loading?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  food_waste: '#059669',
  packaging_waste: '#0891b2',
  process_waste: '#7c3aed',
  hazardous: '#dc2626',
  construction: '#d97706',
  electronic: '#6366f1',
  other: '#6b7280',
};

const TREATMENT_COLORS: Record<string, string> = {
  recycling: '#059669',
  composting: '#10b981',
  anaerobic_digestion: '#14b8a6',
  reuse: '#06b6d4',
  incineration_with_recovery: '#f59e0b',
  incineration_without_recovery: '#ef4444',
  landfill: '#6b7280',
  other: '#9ca3af',
};

function WasteHierarchyPyramid({ wasteByTreatment }: { wasteByTreatment: WasteByTreatmentItem[] }) {
  const hierarchy = [
    { level: 'Prevention', treatments: [], color: '#059669', target: 100 },
    { level: 'Reuse', treatments: ['reuse'], color: '#10b981', target: 80 },
    { level: 'Recycling', treatments: ['recycling', 'composting', 'anaerobic_digestion'], color: '#0891b2', target: 60 },
    { level: 'Recovery', treatments: ['incineration_with_recovery'], color: '#f59e0b', target: 40 },
    { level: 'Disposal', treatments: ['landfill', 'incineration_without_recovery', 'other'], color: '#ef4444', target: 0 },
  ];

  const totalWaste = wasteByTreatment.reduce((sum, t) => sum + t.total_kg, 0);

  return (
    <div className="space-y-3">
      {hierarchy.map((level, idx) => {
        const levelWaste = wasteByTreatment
          .filter((t) => level.treatments.includes(t.treatment_method))
          .reduce((sum, t) => sum + t.total_kg, 0);
        const percentage = totalWaste > 0 ? (levelWaste / totalWaste) * 100 : 0;

        return (
          <div key={level.level} className="relative">
            <div className="flex items-center gap-3">
              <div
                className="w-24 text-xs font-medium text-right"
                style={{ color: level.color }}
              >
                {level.level}
              </div>
              <div className="flex-1">
                <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden relative">
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${Math.min(percentage, 100)}%`,
                      backgroundColor: level.color,
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
                    {percentage > 0 ? `${percentage.toFixed(1)}%` : '-'}
                  </div>
                </div>
              </div>
              <div className="w-20 text-xs text-muted-foreground text-right">
                {levelWaste > 0 ? `${(levelWaste / 1000).toFixed(2)} t` : '-'}
              </div>
            </div>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground text-center mt-4">
        EU Waste Framework Directive hierarchy compliance
      </p>
    </div>
  );
}

function CircularityGauge({ rate, target }: { rate: number; target?: number }) {
  const getStatusColor = (value: number) => {
    if (value >= 80) return 'text-green-600';
    if (value >= 60) return 'text-emerald-600';
    if (value >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  const getStatusLabel = (value: number) => {
    if (value >= 80) return 'Excellent';
    if (value >= 60) return 'Good';
    if (value >= 40) return 'Fair';
    return 'Needs Improvement';
  };

  return (
    <div className="text-center space-y-2">
      <div className="relative w-32 h-32 mx-auto">
        <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="12"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={rate >= 60 ? '#059669' : rate >= 40 ? '#f59e0b' : '#ef4444'}
            strokeWidth="12"
            strokeDasharray={`${rate * 2.51} 251`}
            strokeLinecap="round"
          />
          {target && (
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeDasharray="4 4"
              strokeDashoffset={`${(100 - target) * 2.51}`}
              opacity="0.5"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${getStatusColor(rate)}`}>
            {rate.toFixed(0)}%
          </span>
          <span className="text-xs text-muted-foreground">Circular</span>
        </div>
      </div>
      <Badge variant="outline" className={getStatusColor(rate)}>
        {getStatusLabel(rate)}
      </Badge>
      {target && (
        <p className="text-xs text-muted-foreground">
          Target: {target}%
        </p>
      )}
    </div>
  );
}

function TargetProgressCard({ targets, currentMetrics }: { targets: CircularityTarget | null; currentMetrics: WasteMetrics }) {
  if (!targets) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center text-muted-foreground">
          <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No circularity targets set</p>
          <p className="text-xs mt-1">Set targets to track progress</p>
        </CardContent>
      </Card>
    );
  }

  const targetItems = [
    {
      name: 'Waste Diversion',
      current: currentMetrics.waste_diversion_rate,
      target: targets.waste_diversion_target,
      unit: '%',
    },
    {
      name: 'Recycled Content',
      current: currentMetrics.recycled_content_avg,
      target: targets.recycled_content_target,
      unit: '%',
    },
    {
      name: 'Packaging Recyclability',
      current: currentMetrics.avg_recyclability_score,
      target: targets.packaging_recyclability_target,
      unit: '%',
    },
  ].filter((item) => item.target > 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Target className="h-4 w-4 text-blue-600" />
          {targets.target_year} Targets
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {targetItems.map((item) => {
          const progress = item.target > 0 ? (item.current / item.target) * 100 : 0;
          const onTrack = progress >= 100;
          return (
            <div key={item.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{item.name}</span>
                <span className={onTrack ? 'text-green-600' : 'text-amber-600'}>
                  {item.current.toFixed(0)}{item.unit} / {item.target}{item.unit}
                </span>
              </div>
              <Progress value={Math.min(progress, 100)} className="h-2" />
            </div>
          );
        })}
        {targets.zero_waste_to_landfill_target && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30">
            {currentMetrics.waste_by_treatment.find((t) => t.treatment_method === 'landfill')?.total_kg === 0 ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            )}
            <span className="text-xs font-medium">Zero Waste to Landfill Target</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function WasteDeepDive({ wasteMetrics, loading }: WasteDeepDiveProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-64 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!wasteMetrics || wasteMetrics.total_waste_kg === 0) {
    return (
      <Card>
        <CardContent className="p-8 space-y-4">
          <div className="flex items-center justify-center">
            <Recycle className="h-16 w-16 text-amber-400" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">No Waste Data Available</h3>
            <p className="text-sm text-muted-foreground">
              Start logging waste data from your facilities to see comprehensive waste and circularity metrics.
            </p>
          </div>
          <div className="flex justify-center">
            <Badge variant="outline">Log waste data to begin</Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  const categoryChartData = wasteMetrics.waste_by_category.map((cat) => ({
    name: cat.category_display,
    value: cat.total_kg,
    percentage: cat.percentage,
    color: CATEGORY_COLORS[cat.category] || '#6b7280',
  }));

  const treatmentChartData = wasteMetrics.waste_by_treatment.map((t) => ({
    name: t.treatment_display,
    value: t.total_kg,
    percentage: t.percentage,
    isCircular: t.is_circular,
    color: TREATMENT_COLORS[t.treatment_method] || '#6b7280',
  }));

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50">
              <Info className="h-5 w-5 text-amber-700 dark:text-amber-400" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  Cradle-to-Gate Scope: Operational Waste Only
                </h4>
                <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300">
                  GHG Protocol Scope 3.5
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground space-y-1.5">
                <p>
                  <strong className="text-amber-800 dark:text-amber-200">What is measured:</strong> All waste generated during production operations at your facilities - including raw material processing residues, damaged packaging, process waste, and hazardous operational materials.
                </p>
                <p>
                  <strong className="text-amber-800 dark:text-amber-200">What is NOT included:</strong> Consumer end-of-life waste (packaging disposed by customers after product use). This would require cradle-to-grave analysis extending beyond the factory gate.
                </p>
                <p>
                  <strong className="text-amber-800 dark:text-amber-200">Data sources:</strong> Primary measured data from facility waste manifests, weighbridge records, and third-party waste contractor reports.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 dark:text-amber-300">ISO 14064-1</Badge>
                <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 dark:text-amber-300">CSRD ESRS E5</Badge>
                <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 dark:text-amber-300">EU Waste Framework</Badge>
                <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 dark:text-amber-300">Ellen MacArthur MCI</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="streams" className="text-xs">Waste Streams</TabsTrigger>
          <TabsTrigger value="circularity" className="text-xs">Circularity</TabsTrigger>
          <TabsTrigger value="facilities" className="text-xs">By Facility</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-amber-900 dark:text-amber-100">
                  <Trash2 className="h-4 w-4" />
                  Total Waste Generated
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-amber-900 dark:text-amber-100">
                    {(wasteMetrics.total_waste_kg / 1000).toLocaleString('en-GB', { maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-sm text-muted-foreground">tonnes</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {wasteMetrics.waste_intensity_per_unit.toFixed(3)} kg per unit produced
                </p>
              </CardContent>
            </Card>

            <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-green-900 dark:text-green-100">
                  <Recycle className="h-4 w-4" />
                  Waste Diversion Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-green-900 dark:text-green-100">
                    {wasteMetrics.waste_diversion_rate.toFixed(1)}%
                  </span>
                  <span className="text-sm text-muted-foreground">diverted</span>
                </div>
                <Progress value={wasteMetrics.waste_diversion_rate} className="h-2 mt-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {wasteMetrics.waste_diversion_rate >= 60 ? 'Good performance' : 'Room for improvement'}
                </p>
              </CardContent>
            </Card>

            <Card className={`${wasteMetrics.hazardous_waste_percentage > 5 ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' : 'bg-slate-50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800'}`}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-sm flex items-center gap-2 ${wasteMetrics.hazardous_waste_percentage > 5 ? 'text-red-900 dark:text-red-100' : 'text-slate-900 dark:text-slate-100'}`}>
                  <AlertTriangle className="h-4 w-4" />
                  Hazardous Waste
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${wasteMetrics.hazardous_waste_percentage > 5 ? 'text-red-900 dark:text-red-100' : 'text-slate-900 dark:text-slate-100'}`}>
                    {wasteMetrics.hazardous_waste_percentage.toFixed(1)}%
                  </span>
                  <span className="text-sm text-muted-foreground">of total</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {(wasteMetrics.hazardous_waste_kg / 1000).toFixed(2)} tonnes hazardous
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Waste by Category</CardTitle>
                <CardDescription>Distribution across waste types</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {categoryChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value: number) => [`${(value / 1000).toFixed(2)} t`, 'Mass']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {categoryChartData.slice(0, 4).map((cat) => (
                    <div key={cat.name} className="flex items-center gap-2 text-xs">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="truncate">{cat.name}</span>
                      <span className="text-muted-foreground ml-auto">{cat.percentage.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Waste Hierarchy Performance</CardTitle>
                <CardDescription>EU Waste Framework Directive alignment</CardDescription>
              </CardHeader>
              <CardContent>
                <WasteHierarchyPyramid wasteByTreatment={wasteMetrics.waste_by_treatment} />
              </CardContent>
            </Card>
          </div>

          <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4 flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  GHG Emissions from Operational Waste (Scope 3 Category 5)
                </p>
                <p className="text-xs text-muted-foreground">
                  Total waste-related emissions: <strong>{(wasteMetrics.total_waste_emissions_kg_co2e / 1000).toFixed(2)} tCO₂eq</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  Calculated using DEFRA 2024 emission factors for waste treatment methods. Emissions vary by treatment pathway: landfill generates methane, incineration produces CO₂, while recycling/composting avoid virgin material production emissions.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="streams" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Waste Treatment Breakdown</CardTitle>
              <CardDescription>How waste is processed and disposed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={treatmentChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}t`} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                    <RechartsTooltip
                      formatter={(value: number) => [`${(value / 1000).toFixed(2)} tonnes`, 'Mass']}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {treatmentChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Detailed Waste Streams</CardTitle>
              <CardDescription>All recorded waste entries</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800">
                      <TableHead className="font-semibold text-xs">Category</TableHead>
                      <TableHead className="font-semibold text-xs">Treatment</TableHead>
                      <TableHead className="font-semibold text-xs text-right">Mass (kg)</TableHead>
                      <TableHead className="font-semibold text-xs text-right">Emissions</TableHead>
                      <TableHead className="font-semibold text-xs">Circular</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wasteMetrics.waste_by_treatment.map((stream, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-sm">
                          {wasteMetrics.waste_by_category[0]?.category_display || 'Mixed'}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-2">
                            {stream.is_circular ? (
                              <Recycle className="h-4 w-4 text-green-600" />
                            ) : stream.treatment_method === 'landfill' ? (
                              <Trash2 className="h-4 w-4 text-slate-400" />
                            ) : (
                              <Flame className="h-4 w-4 text-amber-500" />
                            )}
                            {stream.treatment_display}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-right font-mono">
                          {stream.total_kg.toLocaleString('en-GB', { maximumFractionDigits: 1 })}
                        </TableCell>
                        <TableCell className="text-sm text-right font-mono">
                          {((wasteMetrics.total_waste_emissions_kg_co2e * stream.percentage) / 100).toFixed(1)} kg
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={stream.is_circular ? 'border-green-500 text-green-700' : 'border-slate-300 text-slate-500'}
                          >
                            {stream.circularity_score}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="circularity" className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="md:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Circularity Score</CardTitle>
                <CardDescription>Overall circular economy performance</CardDescription>
              </CardHeader>
              <CardContent>
                <CircularityGauge
                  rate={wasteMetrics.circularity_rate}
                  target={wasteMetrics.targets?.circularity_score_target}
                />
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Material Circularity Metrics</CardTitle>
                <CardDescription>Product-level circularity indicators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
                          <div className="flex items-center gap-2 mb-2">
                            <Package className="h-4 w-4 text-blue-600" />
                            <span className="text-xs font-medium">Recycled Content</span>
                          </div>
                          <div className="text-2xl font-bold">
                            {wasteMetrics.recycled_content_avg.toFixed(0)}%
                          </div>
                          <Progress value={wasteMetrics.recycled_content_avg} className="h-1 mt-2" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Average recycled content across all materials</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
                          <div className="flex items-center gap-2 mb-2">
                            <Recycle className="h-4 w-4 text-green-600" />
                            <span className="text-xs font-medium">Recyclability</span>
                          </div>
                          <div className="text-2xl font-bold">
                            {wasteMetrics.avg_recyclability_score.toFixed(0)}%
                          </div>
                          <Progress value={wasteMetrics.avg_recyclability_score} className="h-1 mt-2" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Average recyclability score of packaging materials</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {wasteMetrics.circularity_metrics && (
                  <div className="grid grid-cols-3 gap-3 pt-2 border-t">
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-600">
                        {wasteMetrics.circularity_metrics.reusable_materials_percentage.toFixed(0)}%
                      </div>
                      <div className="text-xs text-muted-foreground">Reusable</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-emerald-600">
                        {wasteMetrics.circularity_metrics.compostable_materials_percentage.toFixed(0)}%
                      </div>
                      <div className="text-xs text-muted-foreground">Compostable</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-600">
                        {wasteMetrics.circularity_metrics.total_materials_assessed}
                      </div>
                      <div className="text-xs text-muted-foreground">Materials</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <TargetProgressCard targets={wasteMetrics.targets} currentMetrics={wasteMetrics} />

          <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Recycle className="h-4 w-4 text-amber-600" />
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Circular Economy Standards</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Metrics aligned with Ellen MacArthur Foundation Material Circularity Indicator (MCI) methodology.
                Circularity score reflects material kept in use through recycling, reuse, and composting pathways.
              </p>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">CSRD E5</Badge>
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">Ellen MacArthur</Badge>
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">EU Taxonomy</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="facilities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Waste by Facility</CardTitle>
              <CardDescription>Performance breakdown across sites</CardDescription>
            </CardHeader>
            <CardContent>
              {wasteMetrics.waste_by_facility.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Factory className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No facility-level data available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {wasteMetrics.waste_by_facility.map((facility) => (
                    <div key={facility.facility_id} className="p-4 rounded-lg border">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-sm">{facility.facility_name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {facility.percentage.toFixed(1)}% of total waste
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={facility.diversion_rate >= 60 ? 'border-green-500 text-green-700' : 'border-amber-500 text-amber-700'}
                        >
                          {facility.diversion_rate.toFixed(0)}% diverted
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-lg font-bold">
                            {(facility.total_kg / 1000).toFixed(2)}
                          </div>
                          <div className="text-xs text-muted-foreground">tonnes total</div>
                        </div>
                        <div>
                          <div className={`text-lg font-bold ${facility.hazardous_kg > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {(facility.hazardous_kg / 1000).toFixed(2)}
                          </div>
                          <div className="text-xs text-muted-foreground">tonnes hazardous</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-green-600">
                            {facility.diversion_rate.toFixed(0)}%
                          </div>
                          <div className="text-xs text-muted-foreground">diversion rate</div>
                        </div>
                      </div>

                      <Progress value={facility.diversion_rate} className="h-2 mt-3" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
