"use client";

import { PageWrapper, SectionHeader } from '../Layout';
import type { LCAReportData } from '../types';

const ROWS_PER_PAGE = 12;

/**
 * Per-ingredient impact table with full data provenance: which factor and
 * database resolved each ingredient, the quality grade, and the confidence
 * score (ISO 14044 §4.2.3.6 data quality transparency). Mirrors the PDF
 * renderer's ingredient breakdown so the on-screen report and the generated
 * PDF tell the same story. Print-targeted: plain coloured spans, no tooltips.
 */
export const IngredientBreakdownPage = ({ data }: { data: LCAReportData }) => {
  const ingredients = data.ingredientBreakdown.ingredients;
  if (ingredients.length === 0) return null;

  const hasProxies = data.ingredientBreakdown.hasProxies;
  const pages: typeof ingredients[] = [];
  for (let i = 0; i < ingredients.length; i += ROWS_PER_PAGE) {
    pages.push(ingredients.slice(i, i + ROWS_PER_PAGE));
  }

  const gradeClass = (grade: string) => {
    const g = (grade || '').toUpperCase();
    if (g === 'HIGH') return 'bg-green-500/15 text-green-400';
    if (g === 'MEDIUM') return 'bg-yellow-500/15 text-yellow-500';
    return 'bg-red-500/15 text-red-400';
  };

  const sourceBadge = (ing: (typeof ingredients)[number]) => {
    if (ing.isProxy) return <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-amber-500/15 text-amber-500">Proxy</span>;
    if (ing.dataSource === 'Primary') return <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-green-500/15 text-green-400">Primary</span>;
    return <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-yellow-500/15 text-yellow-500">Secondary</span>;
  };

  return (
    <>
      {pages.map((pageIngredients, pageIdx) => (
        <PageWrapper key={pageIdx} theme="dark" pageNumber={8}>
          <SectionHeader
            number="08"
            title={pageIdx === 0 ? 'Ingredient Impact Breakdown' : 'Ingredient Impact Breakdown (cont.)'}
            theme="dark"
          />

          {pageIdx === 0 && hasProxies && (
            <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-xs text-amber-500 leading-relaxed">
              <strong>Proxy factors in use:</strong> one or more ingredients are calculated using the
              closest matching dataset from ecoinvent, AGRIBALYSE, or DEFRA. The actual ingredient name
              is shown first; the proxy factor and database are shown beneath it.
            </div>
          )}

          <div className="w-full text-sm">
            <div className="flex text-[10px] font-mono text-neutral-500 uppercase border-b border-white/10 pb-2 mb-2">
              <div className="w-[28%]">Ingredient / Factor</div>
              <div className="w-[10%]">Qty</div>
              <div className="w-[14%]">Origin</div>
              <div className="w-[12%] text-right">GWP (kg CO₂e)</div>
              <div className="w-[10%] text-right">% Climate</div>
              <div className="w-[26%] text-right">Source / Quality</div>
            </div>
            {pageIngredients.map((ing, i) => (
              <div key={i} className="flex py-2.5 border-b border-white/5 text-neutral-300 items-start">
                <div className="w-[28%] pr-3">
                  <div className="font-medium text-neutral-200">{ing.name}</div>
                  {ing.isProxy && (
                    <div className="text-[10px] text-amber-500 mt-0.5">↳ Proxy: {ing.calculationFactor}</div>
                  )}
                  <div className="text-[10px] text-neutral-500 mt-0.5">{ing.factorDatabase}</div>
                </div>
                <div className="w-[10%] text-neutral-400">{ing.quantity} {ing.unit}</div>
                <div className="w-[14%] text-neutral-500 truncate pr-2">{ing.origin}</div>
                <div className="w-[12%] text-right font-medium">{ing.climateImpact}</div>
                <div className="w-[10%] text-right text-[#F2F1EA]">{ing.climatePercentage}</div>
                <div className="w-[26%] text-right">
                  <div className="flex items-center justify-end gap-1.5 flex-wrap">
                    {sourceBadge(ing)}
                    {['HIGH', 'MEDIUM', 'LOW'].includes((ing.dataQualityGrade || '').toUpperCase()) && (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase ${gradeClass(ing.dataQualityGrade)}`}>
                        {ing.dataQualityGrade}
                      </span>
                    )}
                  </div>
                  {ing.confidenceScore > 0 && (
                    <div className="text-[10px] text-neutral-500 mt-0.5">{ing.confidenceScore}% confidence</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {pageIdx === pages.length - 1 && (
            <div className="mt-8 p-4 rounded-xl border border-white/10 bg-white/5 text-xs text-neutral-400 leading-relaxed">
              <strong className="text-[#F2F1EA]">Total climate impact:</strong>{' '}
              {data.ingredientBreakdown.totalClimateImpact} kg CO₂e per functional unit.
              Source badges show where each emission factor came from; the quality grade and confidence
              score show how well that factor matches this exact ingredient.
            </div>
          )}
        </PageWrapper>
      ))}
    </>
  );
};
