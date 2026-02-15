"use client";

import { Scale } from 'lucide-react';
import type { LCADataExecutiveSummary } from '@/lib/types/passport';
import type { TierVisibility } from '@/lib/types/passport';
import SectionHeading from './SectionHeading';

interface ExecutiveSummarySectionProps {
  data: LCADataExecutiveSummary;
  visibility: TierVisibility;
}

export default function ExecutiveSummarySection({
  data,
  visibility,
}: ExecutiveSummarySectionProps) {
  return (
    <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto border-r border-l border-stone-200 bg-white">
      <SectionHeading number="01">Executive Summary</SectionHeading>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
        <div className="md:col-span-8">
          <p className="font-serif text-2xl md:text-3xl leading-relaxed text-stone-800 mb-8">
            {data.heading}
          </p>
          <div className="prose prose-stone text-stone-600 leading-loose columns-1 md:columns-2 gap-12">
            <p>{data.content}</p>
          </div>
        </div>

        {visibility.showKeyHighlight && (
          <div className="md:col-span-4">
            <div className="bg-stone-100 p-8 border border-stone-200 h-full flex flex-col justify-center relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent rounded-full blur-[80px] opacity-0 group-hover:opacity-30 transition-opacity duration-500" />
              <Scale className="w-8 h-8 text-lime-800 mb-6" />
              <h3 className="font-mono text-xs uppercase tracking-widest text-stone-500 mb-4">
                Key Highlight
              </h3>
              <p className="font-serif text-xl italic text-stone-900">
                &ldquo;{data.keyHighlight}&rdquo;
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
