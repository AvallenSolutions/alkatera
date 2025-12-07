"use client"

import dynamic from 'next/dynamic';
import { Leaf, Droplet, Recycle, Sprout } from 'lucide-react';
import { KPICard } from '@/components/dashboard/KPICard';
import { SmartGoalsSection } from '@/components/dashboard/SmartGoalsSection';
import { LiveFeedCard } from '@/components/dashboard/LiveFeedCard';

const ImpactTrajectoryChart = dynamic(
  () => import('@/components/dashboard/ImpactTrajectoryChart').then(mod => ({ default: mod.ImpactTrajectoryChart })),
  { ssr: false }
);

const mockChartData = [
  { month: 'Jan', value: 4000 },
  { month: 'Feb', value: 3200 },
  { month: 'Mar', value: 3400 },
  { month: 'Apr', value: 2800 },
  { month: 'May', value: 3100 },
  { month: 'Jun', value: 2600 },
  { month: 'Jul', value: 2900 },
];

const mockGoals = [
  {
    title: 'Reduce Scope 1 Emissions',
    current: 1204,
    target: 1600,
    unit: 'tCO2e',
    targetYear: 'Q4 2024',
    percentage: 75,
    color: 'lime' as const,
  },
  {
    title: 'Achieve Zero Waste to Landfill',
    current: 850,
    target: 1889,
    unit: 'kg',
    targetYear: 'Q2 2025',
    percentage: 45,
    color: 'cyan' as const,
  },
  {
    title: 'Supply Chain Audit',
    current: 82,
    target: 100,
    unit: 'Suppliers',
    targetYear: 'Q3 2024',
    percentage: 82,
    color: 'emerald' as const,
  },
];

const mockFeedItems = [
  {
    id: '1',
    type: 'error' as const,
    message: 'High water usage detected in Sector 4',
    timestamp: '2 mins ago',
  },
  {
    id: '2',
    type: 'success' as const,
    message: 'Monthly audit completed successfully',
    timestamp: '17 mins ago',
  },
  {
    id: '3',
    type: 'info' as const,
    message: 'Syncing supply chain data...',
    timestamp: '32 mins ago',
  },
  {
    id: '4',
    type: 'success' as const,
    message: 'Scope 3 emissions updated',
    timestamp: '47 mins ago',
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="space-y-1">
        <h1 className="text-3xl font-heading font-bold tracking-tight">
          Sustainability Overview
        </h1>
        <p className="text-sm text-muted-foreground font-data">
          Last updated: Today, 09:41 AM
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          icon={Leaf}
          label="Carbon Footprint"
          value={1204}
          unit="tCO2e"
          trend={-12}
          progress={65}
          color="lime"
        />
        <KPICard
          icon={Droplet}
          label="Water Efficiency"
          value={4.2}
          unit="L/L"
          trend={-5}
          progress={72}
          color="cyan"
        />
        <KPICard
          icon={Recycle}
          label="Spent Grain"
          value={850}
          unit="kg"
          trend={2}
          progress={58}
          color="purple"
        />
        <KPICard
          icon={Sprout}
          label="Biodiversity Score"
          value={88}
          unit="/100"
          trend={4}
          progress={88}
          color="emerald"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {/* <ImpactTrajectoryChart data={mockChartData} /> */}
        </div>
        <LiveFeedCard items={mockFeedItems} />
      </div>

      <SmartGoalsSection goals={mockGoals} />
    </div>
  )
}
