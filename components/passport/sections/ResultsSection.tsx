"use client";

import { motion } from 'framer-motion';
import { Droplets, Recycle, TreeDeciduous } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { LCADataResults, TierVisibility } from '@/lib/types/passport';

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

interface ResultsSectionProps {
  data: LCADataResults;
  visibility: TierVisibility;
}

export default function ResultsSection({
  data,
  visibility,
}: ResultsSectionProps) {
  const showBreakdownChart = visibility.showFullBreakdown && data.breakdown.length > 0;

  return (
    <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto bg-stone-900 text-white overflow-hidden relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-accent rounded-full blur-[150px] opacity-10 pointer-events-none" />

      <div className="relative z-10">
        <SectionHeading number="03">Impact Results</SectionHeading>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="flex flex-col">
            <div className="mb-2 font-mono text-stone-400 uppercase tracking-widest">
              Total Carbon Footprint
            </div>
            <div className="flex items-baseline gap-4 mb-6">
              <span className="font-serif text-7xl md:text-[8rem] leading-none text-brand-accent">
                {data.totalCarbon.toFixed(2)}
              </span>
              <span className="font-serif text-2xl md:text-4xl text-stone-400">
                {data.unit}
              </span>
            </div>

            {visibility.showBenchmarkComparison && data.comparison && (
              <div className="bg-white/5 border border-white/10 p-6 rounded-lg backdrop-blur-sm max-w-md">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm font-mono text-stone-300">
                    vs. {data.comparison.benchmarkName}
                  </span>
                  <span className="text-2xl font-bold text-brand-accent">
                    {data.comparison.reductionPercentage}%
                  </span>
                </div>
                <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${data.comparison.reductionPercentage}%` }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                    className="h-full bg-brand-accent"
                  />
                </div>
                <p className="text-xs text-stone-500 mt-2">
                  Reduction achieved compared to industry average.
                </p>
              </div>
            )}

            {(visibility.showWaterMetrics || visibility.showWasteMetrics || visibility.showLandUseMetrics) && (
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {visibility.showWaterMetrics && data.waterConsumption !== null && data.waterConsumption > 0 && (
                  <div className="bg-white/5 border border-white/10 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Droplets className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-mono text-stone-400 uppercase">Water</span>
                    </div>
                    <span className="text-xl font-semibold text-white">
                      {data.waterConsumption.toFixed(2)}
                    </span>
                    <span className="text-xs text-stone-500 ml-1">m³</span>
                  </div>
                )}
                {visibility.showWasteMetrics && data.wasteGenerated !== null && data.wasteGenerated > 0 && (
                  <div className="bg-white/5 border border-white/10 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Recycle className="w-4 h-4 text-orange-400" />
                      <span className="text-xs font-mono text-stone-400 uppercase">Waste</span>
                    </div>
                    <span className="text-xl font-semibold text-white">
                      {data.wasteGenerated.toFixed(2)}
                    </span>
                    <span className="text-xs text-stone-500 ml-1">kg</span>
                  </div>
                )}
                {visibility.showLandUseMetrics && data.landUse !== null && data.landUse > 0 && (
                  <div className="bg-white/5 border border-white/10 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <TreeDeciduous className="w-4 h-4 text-green-400" />
                      <span className="text-xs font-mono text-stone-400 uppercase">Land Use</span>
                    </div>
                    <span className="text-xl font-semibold text-white">
                      {data.landUse.toFixed(2)}
                    </span>
                    <span className="text-xs text-stone-500 ml-1">m²a</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {showBreakdownChart && (
            <div className="h-[400px] w-full">
              <h4 className="font-mono text-sm text-center mb-8 uppercase tracking-widest text-stone-400">
                Emission Breakdown by Stage
              </h4>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.breakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={140}
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
                    itemStyle={{ color: '#ccff00' }}
                    formatter={(value: number) => `${value}%`}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="flex flex-wrap justify-center gap-6 mt-4">
                {data.breakdown.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs font-mono text-stone-400">
                      {item.name} ({item.value}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
