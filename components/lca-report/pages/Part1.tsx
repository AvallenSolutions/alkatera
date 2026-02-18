"use client";

import { PageWrapper, SectionHeader } from '../Layout';
import { DonutChart, GaugeChart } from '../Charts';
import type { LCAReportData } from '../types';
import { Check, X, ImageIcon } from 'lucide-react';
import { AlkaTeraLogoVertical } from '../Logo';

export const CoverPage = ({ data }: { data: LCAReportData }) => (
  <PageWrapper theme="dark" className="justify-between overflow-hidden relative">
    <div className="absolute inset-0 z-0">
      {data.meta.heroImage ? (
        <img
          src={data.meta.heroImage}
          alt="Background"
          className="w-full h-full object-cover opacity-60"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-stone-800 to-stone-900" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />
    </div>

    <div className="relative z-10 pt-12">
      <AlkaTeraLogoVertical
        className="items-start"
        iconSize="w-12 h-12"
        textSize="text-2xl"
        iconClassName="text-[#ccff00]"
        wordmarkClassName="text-white"
      />
    </div>

    <div className="relative z-10 w-full max-w-2xl">
      <div className="bg-[#ccff00] text-black p-8 rounded-xl shadow-2xl mb-24 transform -rotate-1 backdrop-blur-sm bg-opacity-90">
        <h2 className="font-mono font-bold italic text-2xl tracking-tighter">LIFE CYCLE ASSESSMENT</h2>
      </div>

      <h1 className="text-8xl font-serif font-light leading-tight mb-4 text-white drop-shadow-lg">
        {data.meta.productName}
      </h1>
      <p className="text-2xl text-neutral-200 font-light drop-shadow-md mb-12">{data.meta.organization}</p>
    </div>

    <div className="relative z-10 border border-white/20 rounded-3xl p-8 bg-black/40 backdrop-blur-md mb-20 shadow-xl">
      <div className="text-xs font-mono text-[#ccff00] mb-2 uppercase tracking-widest">Functional Unit</div>
      <div className="text-4xl font-serif mb-2 text-white">1 unit of {data.meta.productName}</div>
      <p className="text-neutral-300 text-sm max-w-lg">{data.functionalUnit.description}</p>
    </div>

    <div className="absolute top-12 right-12 text-right font-mono text-xs opacity-70 text-white z-10">
      <div>REF: {data.meta.refId}</div>
      <div>{data.meta.date}</div>
    </div>
  </PageWrapper>
);

export const ExecSummaryPage = ({ data }: { data: LCAReportData }) => (
  <PageWrapper theme="light" pageNumber={1}>
    <div className="mb-8">
      <SectionHeader number="01" title="Executive Summary" />
    </div>

    <div className="flex flex-col flex-1 pb-20 relative">
      <div className="grid grid-cols-12 gap-6 mb-6">
        <div className="col-span-3">
          <div className="w-full aspect-[2/3] border-2 border-dashed border-neutral-300 rounded-2xl flex flex-col items-center justify-center bg-neutral-50 group cursor-pointer hover:border-[#4d7c0f]/50 transition-colors relative">
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <ImageIcon className="w-8 h-8 text-neutral-400 mb-3 group-hover:text-[#4d7c0f] transition-colors" />
              <span className="text-neutral-400 font-mono text-[10px] uppercase tracking-widest group-hover:text-neutral-600 transition-colors">Product Image</span>
              <span className="text-neutral-300 text-[9px] mt-1 font-mono">(Bottle Portrait)</span>
            </div>
          </div>
        </div>

        <div className="col-span-9 flex flex-col">
          <div className="prose prose-neutral max-w-none text-sm leading-relaxed text-justify text-neutral-600 columns-2 gap-8">
            <p className="mt-0">
              {data.executiveSummary.content}
            </p>
            <p>
              The assessment demonstrates reduced carbon emissions via recycled materials and logistics optimisation. This profile sets a new benchmark for our sustainability targets.
            </p>
            <p>
              Analysis covers all direct and indirect emissions adhering to ISO 14040/44. Expanded boundaries provide granular visibility into supply chain impacts.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 mb-auto">
        <div className="col-span-7 bg-[#4d7c0f] text-white p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between min-h-[140px]">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-[#ccff00]" />
              <div className="font-mono italic text-[#ccff00] text-[10px] uppercase tracking-wider">Key Insight</div>
            </div>
            <div className="text-3xl font-serif leading-none mb-2">
              {data.executiveSummary.keyHighlight.value}
            </div>
            <div className="text-white/90 text-sm leading-snug max-w-md">
              {data.executiveSummary.keyHighlight.label} — {data.executiveSummary.keyHighlight.subtext}
            </div>
          </div>
          <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-[#ccff00] rounded-full blur-[60px] opacity-30 pointer-events-none" />
        </div>

        <div className="col-span-5 bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm flex items-center justify-between min-h-[140px]">
          <div className="flex flex-col justify-center h-full">
            <h3 className="text-sm font-bold font-serif text-neutral-800 uppercase tracking-wider mb-1">Data Quality</h3>
            <div className="text-[10px] font-mono text-neutral-400 mb-2">ISO VERIFIED</div>
            <div className="space-y-1 text-[10px] text-neutral-500">
              <div className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-green-500"></span>Primary Data: 65%</div>
              <div className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-green-500"></span>Temporal: High</div>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-20">
              <GaugeChart score={data.executiveSummary.dataQualityScore} />
            </div>
            <span className="text-[10px] font-mono font-bold text-neutral-400 -mt-1">DQI SCORE</span>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-neutral-100 mb-6">
        <div className="flex justify-between items-center text-xs font-mono text-neutral-500 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
          <div className="flex gap-6">
            <span className="uppercase tracking-widest text-neutral-400">Assessment Scope</span>
            <span className="font-bold text-neutral-700">Cradle-to-Gate</span>
          </div>
          <div className="flex gap-6">
            <span className="text-neutral-400">Period: <span className="text-neutral-700 font-bold">{data.meta.assessmentPeriod}</span></span>
            <span className="text-neutral-400">Published: <span className="text-neutral-700 font-bold">{data.meta.publishedDate}</span></span>
            <span className="text-neutral-400">Ver: <span className="text-neutral-700 font-bold">{data.meta.version}</span></span>
          </div>
        </div>
      </div>
    </div>
  </PageWrapper>
);

export const MethodologyPage = ({ data }: { data: LCAReportData }) => (
  <PageWrapper theme="light" pageNumber={2}>
    <SectionHeader number="02" title="Methodology" />

    <div className="mb-12">
      <h3 className="text-2xl font-serif mb-2">System Boundary</h3>
      <p className="text-neutral-500 font-mono text-sm">cradle-to-gate</p>
    </div>

    <div className="grid grid-cols-2 gap-8 mb-16">
      <div className="bg-neutral-50 rounded-2xl p-8 border border-neutral-100">
        <div className="text-[#65a30d] font-mono italic text-sm mb-6 uppercase">Included Stages</div>
        <ul className="space-y-6">
          {data.methodology.includedStages.map(stage => (
            <li key={stage} className="flex items-center gap-4 text-neutral-700">
              <Check className="w-4 h-4 text-[#65a30d]" />
              {stage}
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-neutral-50 rounded-2xl p-8 border border-neutral-100">
        <div className="text-red-500 font-mono italic text-sm mb-6 uppercase">Excluded Stages</div>
        <ul className="space-y-6">
          {data.methodology.excludedStages.map(stage => (
            <li key={stage} className="flex items-center gap-4 text-neutral-400">
              <X className="w-4 h-4 text-red-400" />
              {stage}
            </li>
          ))}
        </ul>
      </div>
    </div>

    <h3 className="text-2xl font-serif mb-8">Data Sources</h3>
    <div className="grid grid-cols-3 gap-6">
      {data.methodology.dataSources.map(source => (
        <div key={source.name} className="bg-white border rounded-xl p-6 relative">
          <div className="absolute top-4 right-4 bg-[#4d7c0f] text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full">
            {source.count}
          </div>
          <div className="font-bold text-lg mt-4">{source.name}</div>
        </div>
      ))}
    </div>
  </PageWrapper>
);

export const ClimatePage = ({ data }: { data: LCAReportData }) => (
  <PageWrapper theme="dark" pageNumber={3}>
    <SectionHeader number="03" title="Climate Impact" theme="dark" />

    <div className="flex items-center justify-between mb-8">
      <div className="w-1/3">
        <div className="text-sm font-mono text-neutral-500 mb-2">TOTAL CLIMATE IMPACT</div>
        <div className="text-8xl font-serif text-[#ccff00] leading-none">
          {data.climateImpact.totalCarbon}
          <span className="text-2xl text-neutral-500 ml-2 font-sans">kg CO2e</span>
        </div>
      </div>
      <div className="w-2/3">
        <div className="h-[300px]">
          <DonutChart data={data.climateImpact.breakdown} />
        </div>
      </div>
    </div>

    <h3 className="text-xl font-serif mb-6">Lifecycle Breakdown</h3>
    <div className="grid grid-cols-4 gap-4 mb-10">
      {data.climateImpact.stages.map((stage) => (
        <div key={stage.label} className="bg-[#292524] p-4 rounded-xl border border-white/5">
          <div className="w-3 h-3 rounded-full mb-3" style={{ backgroundColor: stage.color }} />
          <div className="text-[10px] font-mono uppercase text-neutral-500 mb-2">{stage.label}</div>
          <div className="text-lg font-bold mb-1">{stage.value.toFixed(3)} <span className="text-xs font-normal opacity-50">kg</span></div>
          <div className="text-[#ccff00] font-mono text-xs">{stage.percentage}%</div>
        </div>
      ))}
    </div>

    <h3 className="text-xl font-serif mb-6">GHG Protocol Scope Breakdown</h3>
    <div className="space-y-4">
      {data.climateImpact.scopes.map((scope) => (
        <div key={scope.name} className="flex items-center gap-8">
          <div className="w-48 text-sm text-neutral-400">{scope.name}</div>
          <div className="flex-1 bg-[#292524] h-6 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${scope.value}%`, backgroundColor: scope.name.includes('Scope 3') ? '#fbbf24' : '#4b5563' }}
            />
          </div>
          <div className="w-12 text-right font-mono text-sm">{scope.value}%</div>
        </div>
      ))}
    </div>
  </PageWrapper>
);
