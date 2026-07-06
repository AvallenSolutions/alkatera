"use client";

import { PageWrapper, SectionHeader } from '../Layout';
import type { LCAReportData } from '../types';

// GHG species rows for the dual-standard inventory table. Each line is reported
// separately so the report satisfies BOTH ISO 14067:2018 (fossil-only headline,
// biogenic excluded) and the GHG Protocol Product Standard (all-species total,
// biogenic disclosed). Biogenic CO₂ carries GWP 1 but is kept out of the headline.
const ghgSpeciesRows = (g: LCAReportData['ghgDetailed']) => [
  { species: 'CO₂ (fossil)', co2e: g.fossilCo2, gwp: '1', accent: '#ef4444', inFossil: true },
  { species: 'CO₂ (biogenic)', co2e: g.biogenicCo2, gwp: '1*', accent: '#22c55e', inFossil: false },
  { species: 'CO₂ (LULUC)', co2e: g.dlucCo2, gwp: '1', accent: '#f97316', inFossil: true },
  { species: 'CH₄ (fossil)', co2e: g.ch4FossilKgCo2e, gwp: '29.8', accent: '#ef4444', inFossil: true },
  { species: 'CH₄ (biogenic)', co2e: g.ch4BiogenicKgCo2e, gwp: '27.0', accent: '#22c55e', inFossil: false },
  { species: 'N₂O', co2e: g.n2oKgCo2e, gwp: '273', accent: '#ef4444', inFossil: true },
  { species: 'HFCs / PFCs', co2e: g.hfcPfc, gwp: 'Var.', accent: '#a8a29e', inFossil: true },
];

export const ClimateMethodologyPage = ({ data }: { data: LCAReportData }) => {
  const g = data.ghgDetailed;
  return (
    <PageWrapper theme="light" pageNumber={5}>
      <SectionHeader number="3A" title="Climate Impact Methodology" theme="light" className="mb-6" />

      <div className="mb-6">
        <h3 className="text-sm uppercase tracking-wider text-neutral-500 mb-2 font-medium">Calculation Methodology</h3>
        <p className="text-neutral-600 text-xs leading-relaxed max-w-3xl">
          Carbon footprint quantified using ISO 14067:2018, with results also presented on a GHG Protocol
          Product Standard basis. Greenhouse gases are converted to CO₂ equivalents using IPCC AR6 100-year
          Global Warming Potential (GWP100) factors, following the attributional life cycle assessment approach.
        </p>
      </div>

      {/* Two headline totals — the heart of dual-standard reporting */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-amber-700 mb-1">Fossil Carbon Footprint (headline)</div>
          <div className="text-2xl font-serif text-amber-900">{g.fossilOnlyTotal ?? g.totalGwp100} <span className="text-sm font-sans text-amber-700">kg CO₂e</span></div>
          <div className="text-[10px] text-amber-700/80 mt-1">Excludes biogenic CO₂ per ISO 14067:2018 §6.4.9.3</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-700 mb-1">Total incl. Biogenic</div>
          <div className="text-2xl font-serif text-emerald-900">{g.totalGwp100} <span className="text-sm font-sans text-emerald-700">kg CO₂e</span></div>
          <div className="text-[10px] text-emerald-700/80 mt-1">All-species basis per GHG Protocol Product Standard</div>
        </div>
      </div>

      {/* Per-gas inventory, each origin reported separately */}
      <div className="mb-5">
        <h3 className="text-base font-normal mb-3 text-neutral-800">GHG Inventory by Species &amp; Origin (IPCC AR6)</h3>
        <div className="border border-neutral-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 bg-neutral-50 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
            <span>Species</span><span className="text-right">kg CO₂e</span><span className="text-right w-16">GWP-100</span>
          </div>
          {ghgSpeciesRows(g).map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-1.5 border-t border-neutral-100 text-xs items-center">
              <span className="flex items-center gap-2 text-neutral-700">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: row.accent }} />
                {row.species}
              </span>
              <span className="text-right font-mono text-neutral-800">{row.co2e}</span>
              <span className="text-right font-mono text-neutral-400 w-16">{row.gwp}</span>
            </div>
          ))}
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 border-t border-neutral-200 bg-emerald-50 text-xs font-semibold items-center">
            <span className="text-emerald-900">Total GWP-100 (all species)</span>
            <span className="text-right font-mono text-emerald-900">{g.totalGwp100}</span>
            <span className="w-16" />
          </div>
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 border-t border-amber-200 bg-amber-50 text-xs font-semibold items-center">
            <span className="text-amber-900">Fossil Carbon Footprint (excl. biogenic)</span>
            <span className="text-right font-mono text-amber-900">{g.fossilOnlyTotal ?? g.totalGwp100}</span>
            <span className="w-16" />
          </div>
        </div>
        <p className="text-[9px] text-neutral-400 mt-1">* Biogenic CO₂ is characterised at GWP 1 for the species inventory but reported separately from the fossil carbon footprint per ISO 14067:2018 §6.4.9.3.</p>
      </div>

      {/* Biogenic carbon disclosure note */}
      {g.biogenicNote && (
        <div className="bg-green-50 border border-green-100 rounded-xl p-3 mb-5">
          <div className="text-[10px] font-semibold text-green-800 mb-1">Biogenic Carbon Note (ISO 14067:2018)</div>
          <p className="text-[10px] text-neutral-600 leading-relaxed">{g.biogenicNote}</p>
        </div>
      )}

      <div>
        <h3 className="text-sm font-normal mb-2 text-neutral-800">Reference Standards</h3>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {data.climateImpact.methodology.standards.map((std, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-neutral-800 mt-1.5"></div>
              <p className="font-mono text-[10px] text-neutral-600">{std}</p>
            </div>
          ))}
        </div>
      </div>
    </PageWrapper>
  );
};

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
          <h4 className="font-mono text-xs text-[#F2F1EA] mb-4 uppercase tracking-wider">Methodological Standards</h4>
          <ul className="space-y-2">
            {data.landUse.methodology.standards.map((std, i) => (
              <li key={i} className="text-sm border-l-2 border-[#205E40] pl-3 py-1">
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
