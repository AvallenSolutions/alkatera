"use client";

import { motion } from 'framer-motion';
import { Leaf, Factory, Truck, Zap, Recycle, Globe, Scale, Info } from 'lucide-react';
import type { LCADataMethodology, LifecycleStageIcon, TierVisibility } from '@/lib/types/passport';

const IconMap: Record<LifecycleStageIcon, React.ElementType> = {
  material: Leaf,
  production: Factory,
  distribution: Truck,
  usage: Zap,
  endOfLife: Recycle,
};

interface SectionHeadingProps {
  children: React.ReactNode;
  number: string;
}

function SectionHeading({ children, number }: SectionHeadingProps) {
  return (
    <div className="flex items-baseline gap-4 mb-8 md:mb-12 border-b border-stone-200 pb-4">
      <span className="font-mono text-lime-800 text-sm font-bold tracking-widest">
        {number}
      </span>
      <h2 className="font-serif text-3xl md:text-5xl text-stone-900">
        {children}
      </h2>
    </div>
  );
}

interface MethodologySectionProps {
  data: LCADataMethodology;
  visibility: TierVisibility;
}

export default function MethodologySection({
  data,
  visibility,
}: MethodologySectionProps) {
  return (
    <section className="py-24 px-6 md:px-12 bg-white border-b border-stone-200">
      <div className="max-w-7xl mx-auto">
        <SectionHeading number="02">Methodology</SectionHeading>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-24 mb-20">
          <div className="col-span-1">
            <h3 className="font-serif text-2xl mb-4">Lifecycle Approach</h3>
            <p className="text-stone-600 leading-relaxed">
              Our assessment follows a comprehensive &ldquo;cradle-to-gate&rdquo; approach,
              tracking every environmental impact from raw material extraction
              through to packaging and distribution.
            </p>
          </div>

          <div className="col-span-1 lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-stone-50 rounded-lg border border-stone-100 hover:border-brand-accent transition-colors duration-300">
              <div className="flex items-center gap-3 mb-3 text-stone-900">
                <div className="p-2 bg-white rounded-full shadow-sm">
                  <Scale className="w-5 h-5 text-lime-600" />
                </div>
                <span className="font-mono text-xs uppercase tracking-wider font-bold">
                  Functional Unit
                </span>
              </div>
              <p className="font-serif text-xl mb-2">
                {data.functionalUnit.value}
              </p>
              <p className="text-sm text-stone-500">
                {data.functionalUnit.description}
              </p>
            </div>

            {visibility.showDataSources && (
              <div className="p-6 bg-stone-50 rounded-lg border border-stone-100 hover:border-brand-accent transition-colors duration-300">
                <div className="flex items-center gap-3 mb-3 text-stone-900">
                  <div className="p-2 bg-white rounded-full shadow-sm">
                    <Globe className="w-5 h-5 text-lime-600" />
                  </div>
                  <span className="font-mono text-xs uppercase tracking-wider font-bold">
                    Data Sources
                  </span>
                </div>
                <ul className="space-y-2">
                  {data.dataSources.map((source, i) => (
                    <li
                      key={i}
                      className="text-sm text-stone-600 flex items-start gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-lime-400 mt-1.5 flex-shrink-0" />
                      {source}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="relative py-12">
          <div className="absolute top-[88px] md:top-[60px] left-0 w-full h-0.5 bg-stone-100 hidden md:block overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: '100%' }}
              transition={{ duration: 1.5, ease: 'easeInOut' }}
              className="h-full bg-stone-300"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10">
            {data.systemBoundaries.stages.map((stage, index) => {
              const Icon = IconMap[stage.icon] || Info;
              const stageColors = [
                'hover:border-emerald-500 hover:text-emerald-600',
                'hover:border-blue-500 hover:text-blue-600',
                'hover:border-amber-500 hover:text-amber-600',
                'hover:border-teal-500 hover:text-teal-600',
              ];
              const colorClass = stageColors[index] || 'hover:border-brand-accent hover:text-lime-800';

              return (
                <motion.div
                  key={stage.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.15 }}
                  className="group relative"
                >
                  <div className="flex flex-col items-center text-center md:gap-6">
                    <div
                      className={`w-20 h-20 md:w-28 md:h-28 rounded-full bg-white border-2 border-stone-100 flex items-center justify-center transition-all duration-300 shadow-sm ${colorClass} group-hover:shadow-md mb-4 md:mb-0 relative z-20`}
                    >
                      <Icon className="w-8 h-8 text-stone-400 group-hover:scale-110 transition-transform duration-300" />
                    </div>

                    <div className="relative p-4 md:p-0 bg-stone-50 md:bg-transparent rounded-lg md:rounded-none w-full md:w-auto">
                      <div className="md:absolute md:-top-44 md:left-1/2 md:-translate-x-1/2 md:w-56 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 pointer-events-none mb-2 md:mb-0 z-30">
                        <div className="bg-stone-900 text-white text-xs p-4 rounded shadow-xl leading-relaxed text-left">
                          <p className="font-bold mb-1 text-brand-accent">
                            {stage.name}
                          </p>
                          {stage.description}
                          <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-stone-900 rotate-45" />
                        </div>
                      </div>

                      <h4 className="font-mono text-sm uppercase tracking-widest font-bold mb-1 group-hover:text-stone-900 transition-colors">
                        {stage.name}
                      </h4>
                      <p className="text-xs text-stone-400 uppercase tracking-wider">
                        Step 0{index + 1}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
