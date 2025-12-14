"use client";

import { motion } from 'framer-motion';
import { Droplets, Recycle, TreeDeciduous, CheckCircle2, XCircle, Factory } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import type { LCADataResults, TierVisibility, LCADataWaterFootprint, LCADataWasteFootprint, LCADataBreakdownItem } from '@/lib/types/passport';

interface SectionHeadingProps {
  children: React.ReactNode;
  number: string;
}

function SectionHeading({ children, number }: SectionHeadingProps) {
  return (
    <div className="flex items-baseline gap-4 mb-8 md:mb-12 border-b border-stone-700 pb-4">
      <span className="font-mono text-brand-accent text-sm font-bold tracking-widest">
        {number}
      </span>
      <h2 className="font-serif text-3xl md:text-5xl text-white">{children}</h2>
    </div>
  );
}

function SubSectionHeading({ children, icon: Icon }: { children: React.ReactNode; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="p-2 bg-white/10 rounded-lg">
        <Icon className="w-5 h-5 text-brand-accent" />
      </div>
      <h3 className="font-serif text-2xl text-white">{children}</h3>
    </div>
  );
}

const CARBON_STAGE_DESCRIPTIONS: Record<string, string> = {
  'Raw Materials': 'Emissions from extraction and processing of raw materials',
  'Packaging': 'Emissions from packaging material production',
  'Processing': 'Emissions from manufacturing and assembly operations',
  'Distribution': 'Emissions from transport to distribution and retail',
  'End of Life': 'Emissions from disposal and waste treatment',
};

interface CarbonFootprintSectionProps {
  data: LCADataResults;
  showBreakdown: boolean;
  showBenchmark: boolean;
  showLandUse: boolean;
}

function CarbonFootprintSection({ data, showBreakdown, showBenchmark, showLandUse }: CarbonFootprintSectionProps) {
  const totalPercentage = data.breakdown.reduce((sum, item) => sum + item.value, 0);
  const carbonValues = data.breakdown.map(item => ({
    ...item,
    absoluteValue: (item.value / 100) * data.totalCarbon,
  }));

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-8 backdrop-blur-sm">
      <SubSectionHeading icon={Factory}>Carbon Footprint</SubSectionHeading>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div>
          <div className="mb-2 font-mono text-stone-400 uppercase tracking-widest text-xs">
            Total Carbon Footprint
          </div>
          <div className="flex items-baseline gap-2 mb-6">
            <span className="font-serif text-6xl text-brand-accent">
              {data.totalCarbon.toFixed(2)}
            </span>
            <span className="font-serif text-xl text-stone-400">{data.unit}</span>
          </div>

          {showBenchmark && data.comparison && (
            <div className="bg-lime-500/10 border border-lime-500/20 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-end mb-2">
                <span className="text-xs font-mono text-lime-300 uppercase tracking-wider">
                  vs. {data.comparison.benchmarkName}
                </span>
                <span className="text-xl font-bold text-brand-accent">
                  -{data.comparison.reductionPercentage}%
                </span>
              </div>
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${data.comparison.reductionPercentage}%` }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                  className="h-full bg-brand-accent"
                />
              </div>
              <p className="text-xs text-stone-500 mt-2">
                Reduction vs industry average
              </p>
            </div>
          )}

          {showLandUse && data.landUse !== null && data.landUse > 0 && (
            <div className="bg-white/5 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TreeDeciduous className="w-4 h-4 text-green-400" />
                <span className="text-xs font-mono text-stone-400 uppercase">Land Use</span>
              </div>
              <span className="text-xl font-semibold text-white">
                {data.landUse.toFixed(2)}
              </span>
              <span className="text-xs text-stone-500 ml-1">m2a</span>
            </div>
          )}
        </div>

        {showBreakdown && data.breakdown.length > 0 && (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.breakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={110}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {data.breakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1c1917',
                    border: '1px solid #333',
                    color: '#fff',
                    fontFamily: 'monospace',
                  }}
                  formatter={(value: number) => `${value}%`}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {showBreakdown && data.breakdown.length > 0 && (
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {carbonValues.map((item, i) => (
            <div key={i} className="bg-white/5 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs font-mono text-stone-400 uppercase">
                  {item.name}
                </span>
              </div>
              <div className="text-lg font-semibold text-white">
                {item.absoluteValue.toFixed(3)} {data.unit}
              </div>
              <div className="text-sm text-brand-accent font-mono">
                {item.value}%
              </div>
              <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                {CARBON_STAGE_DESCRIPTIONS[item.name] || 'Lifecycle stage emissions'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface WaterFootprintSectionProps {
  data: LCADataWaterFootprint;
  showBreakdown: boolean;
}

function WaterFootprintSection({ data, showBreakdown }: WaterFootprintSectionProps) {
  const totalValue = data.breakdown.reduce((sum, item) => sum + item.value, 0);
  const chartData = data.breakdown.map(item => ({
    ...item,
    percentage: Math.round((item.value / totalValue) * 100),
  }));

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-8 backdrop-blur-sm">
      <SubSectionHeading icon={Droplets}>Water Footprint</SubSectionHeading>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div>
          <div className="mb-2 font-mono text-stone-400 uppercase tracking-widest text-xs">
            Total Water Consumption
          </div>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="font-serif text-5xl text-blue-400">
              {data.total.toFixed(1)}
            </span>
            <span className="font-serif text-xl text-stone-400">{data.unit}</span>
          </div>

          {data.scarcityWeighted && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mt-4">
              <div className="text-xs font-mono text-blue-300 uppercase tracking-wider mb-1">
                Water Scarcity Weighted
              </div>
              <div className="text-lg font-semibold text-blue-400">
                {data.scarcityWeighted.toFixed(2)} L eq.
              </div>
              <p className="text-xs text-stone-500 mt-1">
                Adjusted for regional water stress factors
              </p>
            </div>
          )}
        </div>

        {showBreakdown && (
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1c1917',
                    border: '1px solid #333',
                    color: '#fff',
                    fontFamily: 'monospace',
                  }}
                  formatter={(value: number, name: string) => [`${value.toFixed(2)} ${data.unit}`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {showBreakdown && (
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {data.breakdown.map((item, i) => (
            <div key={i} className="bg-white/5 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs font-mono text-stone-400 uppercase">
                  {item.name}
                </span>
              </div>
              <div className="text-lg font-semibold text-white">
                {item.value.toFixed(1)} {item.unit}
              </div>
              {item.description && (
                <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                  {item.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface WasteFootprintSectionProps {
  data: LCADataWasteFootprint;
  showBreakdown: boolean;
}

function WasteFootprintSection({ data, showBreakdown }: WasteFootprintSectionProps) {
  const barChartData = data.breakdown.map(item => ({
    name: item.name,
    value: item.value,
    fill: item.color,
    recyclable: item.recyclable,
  }));

  const recyclableTotal = data.breakdown
    .filter(item => item.recyclable)
    .reduce((sum, item) => sum + item.value, 0);
  const recyclablePercentage = data.total > 0
    ? Math.round((recyclableTotal / data.total) * 100)
    : 0;

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-8 backdrop-blur-sm">
      <SubSectionHeading icon={Recycle}>Waste Footprint</SubSectionHeading>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div>
          <div className="mb-2 font-mono text-stone-400 uppercase tracking-widest text-xs">
            Total Waste Generated
          </div>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="font-serif text-5xl text-orange-400">
              {data.total.toFixed(3)}
            </span>
            <span className="font-serif text-xl text-stone-400">{data.unit}</span>
          </div>

          <div className="flex flex-col gap-3 mt-4">
            {data.recyclingRate !== null && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="text-xs font-mono text-green-300 uppercase tracking-wider mb-1">
                  Recycling Rate
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-lg font-semibold text-green-400">
                    {data.recyclingRate}%
                  </div>
                  <div className="flex-1 bg-white/10 h-2 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${data.recyclingRate}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="h-full bg-green-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {data.circularityScore !== null && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                <div className="text-xs font-mono text-emerald-300 uppercase tracking-wider mb-1">
                  Circularity Score
                </div>
                <div className="text-lg font-semibold text-emerald-400">
                  {data.circularityScore.toFixed(1)} / 10
                </div>
              </div>
            )}

            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-xs font-mono text-stone-400 uppercase tracking-wider mb-1">
                Recyclable Fraction
              </div>
              <div className="text-lg font-semibold text-white">
                {recyclablePercentage}%
              </div>
            </div>
          </div>
        </div>

        {showBreakdown && (
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis type="number" stroke="#666" fontSize={10} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#666"
                  fontSize={10}
                  width={70}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1c1917',
                    border: '1px solid #333',
                    color: '#fff',
                    fontFamily: 'monospace',
                  }}
                  formatter={(value: number) => [`${value.toFixed(4)} ${data.unit}`, 'Amount']}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {barChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {showBreakdown && (
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {data.breakdown.map((item, i) => (
            <div key={i} className="bg-white/5 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs font-mono text-stone-400 uppercase">
                    {item.name}
                  </span>
                </div>
                {item.recyclable ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
              </div>
              <div className="text-lg font-semibold text-white">
                {item.value.toFixed(4)} {item.unit}
              </div>
              {item.description && (
                <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                  {item.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ResultsSectionProps {
  data: LCADataResults;
  visibility: TierVisibility;
}

export default function ResultsSection({
  data,
  visibility,
}: ResultsSectionProps) {
  return (
    <section className="py-24 px-6 md:px-12 bg-stone-900 text-white overflow-hidden relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-accent rounded-full blur-[150px] opacity-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <SectionHeading number="03">Impact Results</SectionHeading>

        <div className="space-y-8">
          <CarbonFootprintSection
            data={data}
            showBreakdown={visibility.showFullBreakdown}
            showBenchmark={visibility.showBenchmarkComparison}
            showLandUse={visibility.showLandUseMetrics}
          />

          {visibility.showWaterMetrics && data.waterFootprint && (
            <WaterFootprintSection
              data={data.waterFootprint}
              showBreakdown={visibility.showWaterBreakdown}
            />
          )}

          {visibility.showWasteMetrics && data.wasteFootprint && (
            <WasteFootprintSection
              data={data.wasteFootprint}
              showBreakdown={visibility.showWasteBreakdown}
            />
          )}
        </div>
      </div>
    </section>
  );
}
