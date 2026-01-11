"use client";

import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Recycle,
  Trash2,
  Flame,
  Leaf,
  Package,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Info,
  Target,
  CheckCircle2,
  AlertTriangle,
  Factory,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from 'recharts';
import type { WasteMetrics, CircularityTarget } from '@/hooks/data/useWasteMetrics';

interface WasteStreamItem {
  id: string;
  stream: string;
  disposition: 'recycling' | 'landfill' | 'incineration' | 'composting' | 'anaerobic_digestion' | 'reuse' | 'incineration_with_recovery' | 'incineration_without_recovery' | 'other';
  mass: number;
  circularityScore: number;
}

interface CircularitySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metrics: WasteMetrics | null;
  loading: boolean;
  year: number;
}

const DISPOSITION_CONFIG: Record<string, { icon: any; className: string; label: string; circular: boolean }> = {
  recycling: { icon: Recycle, className: 'bg-green-600', label: 'Recycling', circular: true },
  composting: { icon: Leaf, className: 'bg-green-600', label: 'Composting', circular: true },
  anaerobic_digestion: { icon: Recycle, className: 'bg-emerald-600', label: 'Anaerobic Digestion', circular: true },
  reuse: { icon: Recycle, className: 'bg-cyan-600', label: 'Reuse', circular: true },
  incineration: { icon: Flame, className: 'bg-orange-600', label: 'Incineration', circular: false },
  incineration_with_recovery: { icon: Flame, className: 'bg-amber-500', label: 'Incineration (Energy)', circular: false },
  incineration_without_recovery: { icon: Flame, className: 'bg-orange-600', label: 'Incineration', circular: false },
  landfill: { icon: Trash2, className: 'bg-slate-500', label: 'Landfill', circular: false },
  other: { icon: Package, className: 'bg-slate-400', label: 'Other', circular: false },
};

function CircularEconomyRadar({ wasteMetrics }: { wasteMetrics: WasteMetrics | null }) {
  if (!wasteMetrics) return null;

  const data = [
    {
      dimension: 'Recycled Input',
      value: wasteMetrics.recycled_content_avg,
      fullMark: 100,
    },
    {
      dimension: 'Recyclability',
      value: wasteMetrics.avg_recyclability_score,
      fullMark: 100,
    },
    {
      dimension: 'Diversion Rate',
      value: wasteMetrics.waste_diversion_rate,
      fullMark: 100,
    },
    {
      dimension: 'Reusable',
      value: wasteMetrics.circularity_metrics?.reusable_materials_percentage || 0,
      fullMark: 100,
    },
    {
      dimension: 'Compostable',
      value: wasteMetrics.circularity_metrics?.compostable_materials_percentage || 0,
      fullMark: 100,
    },
    {
      dimension: 'MCI Score',
      value: (wasteMetrics.material_circularity_indicator || 0) * 100,
      fullMark: 100,
    },
  ];

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
          <Radar
            name="Current"
            dataKey="value"
            stroke="#059669"
            fill="#059669"
            fillOpacity={0.3}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MaterialFlowSankey({ wasteMetrics, wasteStreams }: { wasteMetrics: WasteMetrics | null; wasteStreams: WasteStreamItem[] }) {
  const totalInput = wasteStreams.reduce((sum, s) => sum + s.mass, 0);
  const circularMass = wasteStreams
    .filter((s) => DISPOSITION_CONFIG[s.disposition]?.circular)
    .reduce((sum, s) => sum + s.mass, 0);
  const linearMass = totalInput - circularMass;

  const flowData = [
    { name: 'Recycling', value: wasteStreams.filter((s) => s.disposition === 'recycling').reduce((sum, s) => sum + s.mass, 0), color: '#059669' },
    { name: 'Composting', value: wasteStreams.filter((s) => s.disposition === 'composting').reduce((sum, s) => sum + s.mass, 0), color: '#10b981' },
    { name: 'Reuse', value: wasteStreams.filter((s) => s.disposition === 'reuse').reduce((sum, s) => sum + s.mass, 0), color: '#06b6d4' },
    { name: 'Incineration', value: wasteStreams.filter((s) => s.disposition === 'incineration').reduce((sum, s) => sum + s.mass, 0), color: '#f59e0b' },
    { name: 'Landfill', value: wasteStreams.filter((s) => s.disposition === 'landfill').reduce((sum, s) => sum + s.mass, 0), color: '#6b7280' },
  ].filter((f) => f.value > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {(totalInput / 1000).toFixed(2)}
          </div>
          <div className="text-xs text-muted-foreground">Total Waste (t)</div>
        </div>
        <ArrowRight className="h-6 w-6 text-slate-400" />
        <div className="flex gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {(circularMass / 1000).toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">Circular (t)</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-500">
              {(linearMass / 1000).toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">Linear (t)</div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {flowData.map((flow) => (
          <div key={flow.name} className="flex items-center gap-3">
            <div className="w-24 text-xs font-medium text-right">{flow.name}</div>
            <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${totalInput > 0 ? (flow.value / totalInput) * 100 : 0}%`,
                  backgroundColor: flow.color,
                }}
              />
            </div>
            <div className="w-20 text-xs text-muted-foreground text-right">
              {(flow.value / 1000).toFixed(2)} t
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CircularityScoreGauge({ rate }: { rate: number }) {
  const getStatusColor = (value: number) => {
    if (value >= 80) return '#059669';
    if (value >= 60) return '#10b981';
    if (value >= 40) return '#f59e0b';
    return '#ef4444';
  };

  const getStatusLabel = (value: number) => {
    if (value >= 80) return 'Excellent';
    if (value >= 60) return 'Good';
    if (value >= 40) return 'Fair';
    return 'Needs Improvement';
  };

  return (
    <div className="text-center">
      <div className="relative w-40 h-40 mx-auto">
        <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="10"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={getStatusColor(rate)}
            strokeWidth="10"
            strokeDasharray={`${rate * 2.51} 251`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color: getStatusColor(rate) }}>
            {rate.toFixed(0)}%
          </span>
          <span className="text-xs text-muted-foreground mt-1">Circularity</span>
        </div>
      </div>
      <Badge
        variant="outline"
        className="mt-3"
        style={{ borderColor: getStatusColor(rate), color: getStatusColor(rate) }}
      >
        {getStatusLabel(rate)}
      </Badge>
    </div>
  );
}

export function CircularitySheet({
  open,
  onOpenChange,
  metrics,
  loading,
  year,
}: CircularitySheetProps) {
  const wasteMetrics = metrics;

  const wasteStreams: WasteStreamItem[] = (wasteMetrics?.waste_by_treatment || []).map((t, idx) => ({
    id: String(idx + 1),
    stream: t.treatment_display,
    disposition: t.treatment_method as WasteStreamItem['disposition'],
    mass: Math.round(t.total_kg),
    circularityScore: t.circularity_score,
  }));

  const totalWaste = wasteMetrics?.total_waste_kg || 0;
  const circularityRate = wasteMetrics?.circularity_rate || 0;

  const getDispositionBadge = (disposition: string) => {
    const config = DISPOSITION_CONFIG[disposition] || DISPOSITION_CONFIG.landfill;
    const Icon = config.icon;
    return (
      <Badge variant="default" className={`${config.className} gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getCircularityBadge = (score: number) => {
    if (score >= 80) return { className: 'bg-green-600', label: `${score}% (Circular)` };
    if (score >= 40) return { className: 'bg-amber-600', label: `${score}% (Transitional)` };
    return { className: 'bg-slate-500', label: `${score}% (Linear)` };
  };

  const circularStreams = wasteStreams.filter((s) => DISPOSITION_CONFIG[s.disposition]?.circular);
  const linearStreams = wasteStreams.filter((s) => !DISPOSITION_CONFIG[s.disposition]?.circular);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20">
        <SheetHeader className="space-y-4 mb-6 pb-6 border-b border-amber-200 dark:border-amber-800/50">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/50 dark:to-orange-900/50 shadow-sm">
              <Recycle className="h-6 w-6 text-amber-700 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <SheetTitle className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                Waste & Circularity Analysis
              </SheetTitle>
              <SheetDescription className="mt-2 text-base">
                Comprehensive material flow and circular economy performance metrics
              </SheetDescription>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <Card className="bg-white/80 dark:bg-slate-900/80 border-amber-200">
              <CardContent className="p-3 text-center">
                <div className="text-xl font-bold text-amber-900 dark:text-amber-100">
                  {(totalWaste / 1000).toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">Total Waste (t)</div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 dark:bg-slate-900/80 border-green-200">
              <CardContent className="p-3 text-center">
                <div className="text-xl font-bold text-green-700 dark:text-green-400">
                  {circularityRate.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">Circularity Rate</div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 dark:bg-slate-900/80 border-blue-200">
              <CardContent className="p-3 text-center">
                <div className="text-xl font-bold text-blue-700 dark:text-blue-400">
                  {wasteMetrics?.recycled_content_avg.toFixed(0) || 0}%
                </div>
                <div className="text-xs text-muted-foreground">Recycled Content</div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 dark:bg-slate-900/80 border-cyan-200">
              <CardContent className="p-3 text-center">
                <div className="text-xl font-bold text-cyan-700 dark:text-cyan-400">
                  {wasteMetrics?.avg_recyclability_score.toFixed(0) || 0}%
                </div>
                <div className="text-xs text-muted-foreground">Recyclability</div>
              </CardContent>
            </Card>
          </div>
        </SheetHeader>

        <Tabs defaultValue="overview" className="mt-4">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="streams" className="text-xs">Waste Streams</TabsTrigger>
            <TabsTrigger value="materials" className="text-xs">Materials</TabsTrigger>
            <TabsTrigger value="performance" className="text-xs">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Circularity Score</CardTitle>
                  <CardDescription>Overall circular economy performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <CircularityScoreGauge rate={circularityRate} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Material Flow Summary</CardTitle>
                  <CardDescription>Waste destination breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <MaterialFlowSankey wasteMetrics={wasteMetrics || null} wasteStreams={wasteStreams} />
                </CardContent>
              </Card>
            </div>

            {wasteMetrics && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Circular Economy Dimensions</CardTitle>
                  <CardDescription>Multi-dimensional performance radar</CardDescription>
                </CardHeader>
                <CardContent>
                  <CircularEconomyRadar wasteMetrics={wasteMetrics} />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="streams" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border-green-200 dark:border-green-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-green-800 dark:text-green-200">
                    <Recycle className="h-4 w-4" />
                    Circular Streams
                  </CardTitle>
                  <CardDescription>Material kept in use</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {circularStreams.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No circular waste streams</p>
                    ) : (
                      circularStreams.map((stream) => (
                        <div key={stream.id} className="flex items-center justify-between p-2 rounded bg-green-50 dark:bg-green-950/30">
                          <div className="flex items-center gap-2">
                            {getDispositionBadge(stream.disposition)}
                            <span className="text-sm font-medium">{stream.stream}</span>
                          </div>
                          <span className="text-sm font-mono">{(stream.mass / 1000).toFixed(3)} t</span>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 dark:border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <Trash2 className="h-4 w-4" />
                    Linear Streams
                  </CardTitle>
                  <CardDescription>Material lost from cycle</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {linearStreams.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No linear waste streams</p>
                    ) : (
                      linearStreams.map((stream) => (
                        <div key={stream.id} className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800">
                          <div className="flex items-center gap-2">
                            {getDispositionBadge(stream.disposition)}
                            <span className="text-sm font-medium">{stream.stream}</span>
                          </div>
                          <span className="text-sm font-mono">{(stream.mass / 1000).toFixed(3)} t</span>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">All Waste Streams</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-amber-50 dark:bg-amber-950/30">
                        <TableHead className="font-semibold text-xs">Stream</TableHead>
                        <TableHead className="font-semibold text-xs">Disposition</TableHead>
                        <TableHead className="font-semibold text-xs text-right">Mass (kg)</TableHead>
                        <TableHead className="font-semibold text-xs">Circularity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {wasteStreams.map((item) => {
                        const circularityBadge = getCircularityBadge(item.circularityScore);
                        return (
                          <TableRow key={item.id} className="hover:bg-amber-50/50 dark:hover:bg-amber-950/20">
                            <TableCell className="font-medium text-sm">{item.stream}</TableCell>
                            <TableCell>{getDispositionBadge(item.disposition)}</TableCell>
                            <TableCell className="text-sm text-right font-mono">
                              {item.mass.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="default" className={circularityBadge.className}>
                                {circularityBadge.label}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="materials" className="space-y-4">
            {wasteMetrics?.circularity_metrics ? (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Package className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                      <div className="text-2xl font-bold">{wasteMetrics.recycled_content_avg.toFixed(0)}%</div>
                      <div className="text-xs text-muted-foreground">Avg Recycled Content</div>
                      <Progress value={wasteMetrics.recycled_content_avg} className="h-1 mt-2" />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4 text-center">
                      <Recycle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                      <div className="text-2xl font-bold">{wasteMetrics.avg_recyclability_score.toFixed(0)}%</div>
                      <div className="text-xs text-muted-foreground">Avg Recyclability</div>
                      <Progress value={wasteMetrics.avg_recyclability_score} className="h-1 mt-2" />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4 text-center">
                      <Factory className="h-8 w-8 mx-auto mb-2 text-amber-600" />
                      <div className="text-2xl font-bold">{wasteMetrics.circularity_metrics.total_materials_assessed}</div>
                      <div className="text-xs text-muted-foreground">Materials Assessed</div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Material Properties</CardTitle>
                    <CardDescription>Circular economy attributes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium">Reusable Materials</span>
                        </div>
                        <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                          {wasteMetrics.circularity_metrics.reusable_materials_percentage.toFixed(0)}%
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">of materials can be reused</p>
                      </div>

                      <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                        <div className="flex items-center gap-2 mb-2">
                          <Leaf className="h-4 w-4 text-emerald-600" />
                          <span className="text-sm font-medium">Compostable Materials</span>
                        </div>
                        <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                          {wasteMetrics.circularity_metrics.compostable_materials_percentage.toFixed(0)}%
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">of materials are compostable</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No material circularity data available</p>
                  <p className="text-xs mt-2">Complete product LCAs with packaging data to see material metrics</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            {wasteMetrics?.targets ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-600" />
                    {wasteMetrics.targets.target_year} Circularity Targets
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { name: 'Waste Diversion', current: wasteMetrics.waste_diversion_rate, target: wasteMetrics.targets.waste_diversion_target },
                    { name: 'Recycled Content', current: wasteMetrics.recycled_content_avg, target: wasteMetrics.targets.recycled_content_target },
                    { name: 'Circularity Score', current: circularityRate, target: wasteMetrics.targets.circularity_score_target },
                    { name: 'Packaging Recyclability', current: wasteMetrics.avg_recyclability_score, target: wasteMetrics.targets.packaging_recyclability_target },
                  ].filter((t) => t.target > 0).map((target) => {
                    const progress = target.target > 0 ? (target.current / target.target) * 100 : 0;
                    const onTrack = progress >= 100;
                    return (
                      <div key={target.name} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{target.name}</span>
                          <div className="flex items-center gap-2">
                            {onTrack ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <TrendingUp className="h-4 w-4 text-amber-600" />
                            )}
                            <span className={`text-sm font-mono ${onTrack ? 'text-green-600' : 'text-amber-600'}`}>
                              {target.current.toFixed(0)}% / {target.target}%
                            </span>
                          </div>
                        </div>
                        <Progress value={Math.min(progress, 100)} className="h-2" />
                      </div>
                    );
                  })}

                  {wasteMetrics.targets.zero_waste_to_landfill_target && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 mt-4">
                      {wasteMetrics.waste_by_treatment.find((t) => t.treatment_method === 'landfill')?.total_kg === 0 ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                      )}
                      <div>
                        <p className="text-sm font-medium">Zero Waste to Landfill</p>
                        <p className="text-xs text-muted-foreground">
                          {wasteMetrics.waste_by_treatment.find((t) => t.treatment_method === 'landfill')?.total_kg === 0
                            ? 'Target achieved'
                            : `${(wasteMetrics.waste_by_treatment.find((t) => t.treatment_method === 'landfill')?.total_kg || 0 / 1000).toFixed(2)} tonnes still going to landfill`}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No circularity targets configured</p>
                  <p className="text-xs mt-2">Set targets to track progress towards circular economy goals</p>
                </CardContent>
              </Card>
            )}

            <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Recycle className="h-4 w-4 text-amber-600" />
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Circular Economy Methodology</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Circularity scores follow Ellen MacArthur Foundation Material Circularity Indicator (MCI) principles.
                  Recycling, composting, and reuse pathways score 100% (circular). Incineration with energy recovery scores 50% (transitional).
                  Landfill scores 0% (linear).
                </p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">CSRD E5</Badge>
                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">Ellen MacArthur</Badge>
                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">EU Taxonomy</Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
