"use client";

import { motion } from 'framer-motion';
import { Package, Tag, CircleDot, Box, Recycle } from 'lucide-react';
import type { LCADataPackaging, TierVisibility } from '@/lib/types/passport';
import SectionHeading from './SectionHeading';

interface PackagingSectionProps {
  data: LCADataPackaging;
  visibility: TierVisibility;
  sectionNumber: string;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  container: Package,
  label: Tag,
  closure: CircleDot,
  secondary: Box,
  shipment: Box,
  tertiary: Box,
};

const PATHWAY_STYLES: Record<string, string> = {
  recycling: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  composting: 'bg-green-50 text-green-700 border-green-200',
  reuse: 'bg-blue-50 text-blue-700 border-blue-200',
  anaerobic_digestion: 'bg-teal-50 text-teal-700 border-teal-200',
  incineration: 'bg-orange-50 text-orange-700 border-orange-200',
  landfill: 'bg-red-50 text-red-700 border-red-200',
  mixed: 'bg-stone-50 text-stone-700 border-stone-200',
};

function formatPathway(pathway: string): string {
  return pathway
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export default function PackagingSection({
  data,
  visibility,
  sectionNumber,
}: PackagingSectionProps) {
  const showDetail = visibility.showPackagingDetail;

  return (
    <section className="py-24 px-6 md:px-12 bg-stone-100">
      <div className="max-w-7xl mx-auto">
        <SectionHeading number={sectionNumber}>Packaging &amp; Circularity</SectionHeading>

        {/* Aggregate metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-12">
          {data.circularEndOfLifePercentage !== null && (
            <div className="bg-white rounded-xl p-6 border border-stone-200 text-center">
              <p className="font-serif text-4xl text-stone-900">
                {data.circularEndOfLifePercentage}%
              </p>
              <p className="font-mono text-xs text-stone-500 uppercase tracking-widest mt-2">
                Circular End-of-Life
              </p>
            </div>
          )}

          {data.averageRecycledContent !== null && showDetail && (
            <div className="bg-white rounded-xl p-6 border border-stone-200 text-center">
              <p className="font-serif text-4xl text-stone-900">
                {data.averageRecycledContent}%
              </p>
              <p className="font-mono text-xs text-stone-500 uppercase tracking-widest mt-2">
                Avg Recycled Content
              </p>
            </div>
          )}

          {data.circularityScore !== null && showDetail && (
            <div className="bg-white rounded-xl p-6 border border-stone-200 text-center">
              <div className="relative inline-flex items-center justify-center">
                <svg className="w-20 h-20" viewBox="0 0 80 80">
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    fill="none"
                    stroke="#e7e5e4"
                    strokeWidth="6"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    fill="none"
                    stroke="#ccff00"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${(data.circularityScore / 100) * 213.6} 213.6`}
                    transform="rotate(-90 40 40)"
                  />
                </svg>
                <span className="absolute font-serif text-xl text-stone-900">
                  {data.circularityScore}
                </span>
              </div>
              <p className="font-mono text-xs text-stone-500 uppercase tracking-widest mt-2">
                Circularity Score
              </p>
            </div>
          )}
        </div>

        {/* Component cards */}
        {showDetail && data.components.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.components.map((component, index) => {
              const Icon = CATEGORY_ICONS[component.packagingCategory] || Package;
              return (
                <motion.div
                  key={`${component.name}-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white rounded-lg border border-stone-200 p-5"
                >
                  <div className="p-2 bg-stone-50 rounded-full inline-flex mb-3">
                    <Icon className="w-5 h-5 text-stone-500" />
                  </div>

                  <p className="font-mono text-sm font-bold text-stone-900 mb-1">
                    {component.name}
                  </p>
                  <p className="text-xs text-stone-400 capitalize mb-4">
                    {component.packagingCategory.replace(/_/g, ' ')}
                  </p>

                  {component.recycledContentPercentage !== null && (
                    <div className="mb-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-stone-500">Recycled content</span>
                        <span className="font-mono text-xs text-lime-800 font-bold">
                          {component.recycledContentPercentage}%
                        </span>
                      </div>
                      <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${component.recycledContentPercentage}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 1, ease: 'easeOut' }}
                          className="h-full bg-brand-accent rounded-full"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {component.endOfLifePathway && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-mono border ${PATHWAY_STYLES[component.endOfLifePathway] || PATHWAY_STYLES.mixed}`}>
                        <Recycle className="w-3 h-3" />
                        {formatPathway(component.endOfLifePathway)}
                      </span>
                    )}
                    {component.isReusable && (
                      <span className="inline-flex items-center bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 text-xs font-mono">
                        Reusable
                      </span>
                    )}
                    {component.isCompostable && (
                      <span className="inline-flex items-center bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5 text-xs font-mono">
                        Compostable
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
