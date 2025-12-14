"use client";

import { PageWrapper, SectionHeader } from '../Layout';
import type { LCAReportData } from '../types';

export const ClimateMethodologyPage = ({ data }: { data: LCAReportData }) => (
  <PageWrapper theme="light" pageNumber={5}>
    <SectionHeader number="3A" title="Climate Impact Methodology" theme="light" className="mb-8" />

    <div className="mb-8">
      <h3 className="text-sm uppercase tracking-wider text-neutral-500 mb-3 font-medium">Calculation Methodology</h3>
      <p className="text-neutral-600 text-sm leading-relaxed max-w-3xl">
        Carbon footprint calculated using ISO 14067:2018 methodology for quantification and communication of greenhouse gas emissions.
        All greenhouse gases are converted to CO2 equivalents using IPCC AR6 100-year Global Warming Potential (GWP100) factors.
        Calculations follow the attributional life cycle assessment approach.
      </p>
    </div>

    <div className="mb-8">
      <h3 className="text-xl font-normal mb-6 text-neutral-800">IPCC AR6 GHG Breakdown</h3>
      <div className="space-y-3">
        {data.climateImpact.methodology.ghgBreakdown.map((item, i) => (
          <div key={i} className="flex items-center justify-between bg-neutral-50 rounded-xl p-5 border border-neutral-100">
            <div className="flex items-center gap-4">
              <span className="font-mono text-lg text-emerald-600 font-medium italic">{item.label}</span>
            </div>
            <div className="font-mono font-medium text-lg">{item.value} <span className="text-neutral-400 text-base">{item.unit}</span></div>
            <div className="text-xs text-neutral-400 font-mono">GWP: {item.gwp}</div>
          </div>
        ))}
      </div>
    </div>

    <div>
      <h3 className="text-xl font-normal mb-4 text-neutral-800">Compliance Standards</h3>
      <div className="space-y-2">
        {data.climateImpact.methodology.standards.map((std, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-neutral-800 mt-2"></div>
            <p className="font-mono text-sm text-neutral-600">{std}</p>
          </div>
        ))}
      </div>
    </div>
  </PageWrapper>
);

export const WaterMethodologyPage = ({ data }: { data: LCAReportData }) => (
  <PageWrapper theme="light" pageNumber={8}>
    <SectionHeader number="4A" title="Water Impact Methodology" theme="light" className="mb-8" />

    <div className="mb-8">
      <h3 className="text-sm uppercase tracking-wider text-neutral-500 mb-3 font-medium">AWARE Methodology</h3>
      <p className="text-neutral-600 text-sm leading-relaxed max-w-3xl">
        Water scarcity assessment uses the AWARE (Available WAter REmaining) methodology developed by UNEP-SETAC Life Cycle Initiative.
        AWARE characterises the relative available water remaining per area in a watershed, after human and aquatic ecosystem demands have been met.
        Results are expressed in cubic metres world-equivalent (m3 eq.).
      </p>
    </div>

    <div className="mb-8">
      <h3 className="text-xl font-normal mb-6 text-neutral-800">Calculation Approach</h3>
      <div className="space-y-4">
        {data.waterFootprint.methodology.steps.map((step, i) => (
          <div key={i} className="flex items-start gap-5">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs">
              {step.step}
            </div>
            <div className="pt-0.5">
              <h4 className="font-medium text-neutral-900 mb-0.5 text-sm">{step.title}</h4>
              <p className="text-neutral-500 text-xs leading-relaxed">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div className="mt-auto">
      <h3 className="text-xl font-normal mb-4 text-neutral-800">Compliance Standards</h3>
      <div className="space-y-2">
        {data.waterFootprint.methodology.standards.map((std, i) => (
          <div key={i} className="flex items-start gap-6">
            <span className="font-mono text-sm font-bold text-neutral-900 min-w-[100px]">{std.split('—')[0]}</span>
            <span className="text-sm text-neutral-500">{std.split('—')[1] || std}</span>
          </div>
        ))}
      </div>
    </div>
  </PageWrapper>
);

export const CircularityMethodologyPage = ({ data }: { data: LCAReportData }) => (
  <PageWrapper theme="light" pageNumber={10}>
    <SectionHeader number="5A" title="Waste & Circularity Methodology" theme="light" className="mb-8" />

    <div className="mb-8">
      <p className="text-neutral-600 text-sm leading-relaxed max-w-3xl">
        Waste assessment follows the circular economy principles, quantifying material flows and end-of-life scenarios.
        Circularity metrics evaluate how well materials are kept in use through recycling, reuse, and recovery pathways.
        Calculations align with the Ellen MacArthur Foundation Material Circularity Indicator and EU Waste Framework Directive.
      </p>
    </div>

    <div className="mb-10">
      <h3 className="text-xl font-normal mb-6 text-neutral-800">Circularity Calculation</h3>
      <div className="font-mono text-xs text-neutral-500 mb-6 p-4 bg-neutral-50 rounded-lg inline-block border border-neutral-100">
        {data.circularity.methodology.formula.text}
      </div>

      <div className="space-y-2 pl-2 border-l-2 border-neutral-100">
        {data.circularity.methodology.formula.definitions.map((def, i) => (
          <div key={i} className="text-xs">
            <span className="font-medium text-neutral-700">{def.term}</span>
            <span className="text-neutral-400 mx-2">=</span>
            <span className="text-neutral-500">{def.definition}</span>
          </div>
        ))}
      </div>
    </div>

    <div className="mt-auto">
      <h3 className="text-xl font-normal mb-4 text-neutral-800">Compliance Standards</h3>
      <div className="space-y-3">
        {data.circularity.methodology.standards.map((std, i) => (
          <div key={i} className="grid grid-cols-[180px_1fr] gap-4 items-baseline">
            <span className="font-mono text-sm font-bold text-neutral-900 italic">{std.split('   ')[0]}</span>
            <span className="text-sm text-neutral-500">{std.split('   ')[1] || std}</span>
          </div>
        ))}
      </div>
    </div>
  </PageWrapper>
);

export const LandUseMethodologyPage = ({ data }: { data: LCAReportData }) => (
  <PageWrapper pageNumber={12}>
    <SectionHeader number="06" title="Land Use & Nature Methodology" className="mb-6" />

    <div className="grid grid-cols-12 gap-8">
      <div className="col-span-8 space-y-6">
        <div className="bg-white border border-neutral-200 p-6 rounded-lg">
          <h3 className="font-serif text-xl mb-4">Impact Assessment Categories</h3>
          <div className="space-y-4">
            {data.landUse.methodology.categories.map((cat, i) => (
              <div key={i} className="border-b border-neutral-100 last:border-0 pb-4 last:pb-0">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="font-bold text-neutral-900">{cat.title}</span>
                  <span className="font-mono text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{cat.value}</span>
                </div>
                <p className="text-sm text-neutral-600 leading-relaxed">{cat.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-neutral-50 p-6 rounded-lg">
          <h4 className="font-bold text-sm mb-3">Biodiversity Risk Filter</h4>
          <p className="text-sm text-neutral-600 leading-relaxed">
            Spatial analysis performed using WWF Biodiversity Risk Filter to identify high-value conservation areas within the supply chain. Analysis resolution: 10km2.
          </p>
        </div>
      </div>

      <div className="col-span-4 space-y-6">
        <div className="bg-neutral-900 text-white p-6 rounded-lg">
          <h4 className="font-mono text-xs text-[#ccff00] mb-4 uppercase tracking-wider">Methodological Standards</h4>
          <ul className="space-y-2">
            {data.landUse.methodology.standards.map((std, i) => (
              <li key={i} className="text-sm border-l-2 border-[#ccff00] pl-3 py-1">
                {std}
              </li>
            ))}
          </ul>
        </div>

        <div className="border border-neutral-200 p-5 rounded-lg">
          <h4 className="font-bold text-sm mb-2">Key Assumptions</h4>
          <ul className="text-xs text-neutral-600 space-y-2 list-disc pl-4">
            <li>Land occupation calculated based on average yield data for region</li>
            <li>Transformation impacts amortised over 20 years</li>
            <li>Indirect land use change (iLUC) excluded from primary analysis</li>
          </ul>
        </div>
      </div>
    </div>
  </PageWrapper>
);
