"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, RefreshCw, Calendar, TrendingUp } from 'lucide-react';

import { useCompanyMetrics } from '@/hooks/data/useCompanyMetrics';
import { ClimateCard } from '@/components/vitality/ClimateCard';
import { WaterCard } from '@/components/vitality/WaterCard';
import { WasteCard } from '@/components/vitality/WasteCard';
import { NatureCard } from '@/components/vitality/NatureCard';
import { CarbonDeepDive } from '@/components/vitality/CarbonDeepDive';
import { WaterDeepDive } from '@/components/vitality/WaterDeepDive';
import { WasteDeepDive } from '@/components/vitality/WasteDeepDive';
import { NatureDeepDive } from '@/components/vitality/NatureDeepDive';
import { AICopilotModal } from '@/components/vitality/AICopilotModal';

export default function PerformancePage() {
  const {
    metrics,
    scopeBreakdown,
    facilityWaterRisks,
    natureMetrics,
    loading,
    error,
    refetch,
  } = useCompanyMetrics();

  const [activeTab, setActiveTab] = useState('carbon');
  const [aiModalOpen, setAiModalOpen] = useState(false);

  const totalCO2 = metrics?.total_impacts.climate_change_gwp100 || 0;

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Company Vitality</h1>
          <p className="text-lg text-muted-foreground">
            Multi-capital environmental performance powered by ReCiPe 2016
          </p>
          {metrics?.last_updated && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                Last updated: {new Date(metrics.last_updated).toLocaleString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={refetch}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => setAiModalOpen(true)}
            className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            <Sparkles className="h-4 w-4" />
            Ask the Data (AI)
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error Loading Metrics</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && metrics && metrics.total_products_assessed === 0 && (
        <Alert>
          <TrendingUp className="h-4 w-4" />
          <AlertTitle>No Data Yet</AlertTitle>
          <AlertDescription>
            Complete product LCAs with the new multi-capital calculation engine to see your Company Vitality metrics.
            The platform will automatically aggregate impacts across all products.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <ClimateCard metrics={metrics} loading={loading} />
        <WaterCard metrics={metrics} loading={loading} />
        <WasteCard metrics={metrics} loading={loading} />
        <NatureCard metrics={metrics} loading={loading} />
      </div>

      {metrics && metrics.csrd_compliant_percentage > 0 && (
        <div className="flex items-center justify-center gap-4 py-4">
          <Badge variant="default" className="bg-green-600 text-sm px-4 py-2">
            {metrics.csrd_compliant_percentage.toFixed(0)}% CSRD Compliant
          </Badge>
          <span className="text-sm text-muted-foreground">
            {metrics.total_products_assessed} products assessed with ReCiPe 2016 Midpoint (H)
          </span>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">Deep Dive Analysis</h2>
            <p className="text-muted-foreground">
              Explore detailed breakdowns and identify improvement opportunities
            </p>
          </div>
          <Badge variant="outline">
            Metric-First Dashboard
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="carbon">Carbon</TabsTrigger>
            <TabsTrigger value="water">Water</TabsTrigger>
            <TabsTrigger value="waste">Circularity</TabsTrigger>
            <TabsTrigger value="nature">Nature</TabsTrigger>
          </TabsList>

          <TabsContent value="carbon" className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <CarbonDeepDive scopeBreakdown={scopeBreakdown} totalCO2={totalCO2} />
            )}
          </TabsContent>

          <TabsContent value="water" className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <WaterDeepDive facilityWaterRisks={facilityWaterRisks} />
            )}
          </TabsContent>

          <TabsContent value="waste" className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <WasteDeepDive />
            )}
          </TabsContent>

          <TabsContent value="nature" className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <NatureDeepDive natureMetrics={natureMetrics} />
            )}
          </TabsContent>
        </Tabs>
      </div>

      <AICopilotModal open={aiModalOpen} onOpenChange={setAiModalOpen} />
    </div>
  );
}
