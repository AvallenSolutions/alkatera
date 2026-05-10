"use client";

import React from 'react';
import { Info, TrendingUp, Target, Award, Calculator, ArrowUpRight, Dog, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

type ScoreType =
  | 'overall'
  | 'climate'
  | 'water'
  | 'circularity'
  | 'nature'
  | 'composite'
  | 'environmental'
  | 'social'
  | 'governance';

export interface CalculationInputs {
  // Climate
  totalEmissions?: number;
  emissionsIntensity?: number;
  industryBenchmark?: number;
  intensityRatio?: number;
  /**
   * Blended climate breakdown (intensity vs benchmark + YoY trend). When
   * present, the climate explainer shows the per-unit math with the two
   * sub-scores so users see exactly how the score was reached. The
   * legacy intensity/ratio fields above remain for callers that haven't
   * migrated yet.
   */
  climateBreakdown?: {
    score: number | null;
    intensity_sub: number | null;
    yoy_sub: number | null;
    mode: 'blended' | 'intensity_only' | 'yoy_only' | 'no_data';
    weights: { intensity: number; yoy: number };
  } | null;
  benchmarkSource?: {
    name: string;
    url: string;
    year: number;
    category?: string;
  };
  // Water
  waterRiskLevel?: 'high' | 'medium' | 'low';
  waterConsumption?: number;
  /**
   * Blended water breakdown (intensity vs benchmark + YoY trend, plus
   * scarcity context shown but not scored). When present, the water
   * explainer renders the per-unit math with both sub-scores and the
   * AWARE scarcity factor.
   */
  waterBreakdown?: {
    score: number | null;
    intensity_sub: number | null;
    yoy_sub: number | null;
    mode: 'blended' | 'intensity_only' | 'yoy_only' | 'no_data';
    weights: { intensity: number; yoy: number };
    avg_scarcity_factor: number | null;
    source: 'facility' | 'lca' | null;
  } | null;
  // Circularity
  circularityRate?: number;
  /**
   * Blended circularity breakdown (3 axes — recycled content in, packaging
   * recyclability out, tier-weighted diversion — plus waste-intensity YoY).
   * The treatment_mix is shown so users can see which routes their waste
   * takes. Tier weighting follows the EU Waste Framework Directive
   * 2008/98/EC hierarchy.
   */
  circularityBreakdown?: {
    score: number | null;
    axes: {
      recycled_content_sub: number | null;
      packaging_recyclability_sub: number | null;
      diversion_sub: number | null;
    };
    practices_sub: number | null;
    intensity_yoy_sub: number | null;
    mode: 'blended' | 'practices_only' | 'yoy_only' | 'no_data';
    weights: { practices: number; yoy: number };
    treatment_mix: {
      reuse: number;
      composting: number;
      anaerobic_digestion: number;
      recycling: number;
      incineration_with_recovery: number;
      landfill: number;
      incineration_without_recovery: number;
      other: number;
    };
  } | null;
  // Nature
  biodiversityRisk?: 'high' | 'medium' | 'low';
  landUse?: number;
  /**
   * Blended nature breakdown using EU EF 3.1 weighting (Sala et al., 2021):
   * land use 42.2%, terrestrial acidification 33.0%, freshwater
   * eutrophication 14.9%, terrestrial ecotoxicity 9.9%. Each axis is scored
   * against published thresholds (JRC/ReCiPe/EU WFD/DEFRA) then weighted-
   * blended. YoY trend is on the EF 3.1 normalised+weighted footprint.
   */
  natureBreakdown?: {
    score: number | null;
    axes: {
      land_use_sub: number | null;
      terrestrial_acidification_sub: number | null;
      freshwater_eutrophication_sub: number | null;
      terrestrial_ecotoxicity_sub: number | null;
    };
    per_unit: {
      land_use: number | null;
      terrestrial_acidification: number | null;
      freshwater_eutrophication: number | null;
      terrestrial_ecotoxicity: number | null;
    };
    practices_sub: number | null;
    yoy_sub: number | null;
    nature_positive_sub: number | null;
    effective_hectares: number | null;
    country_biodiversity_multiplier: number | null;
    country_mix: Array<{
      country_code: string;
      country_name: string;
      share_pct: number;
      multiplier: number;
      hotspot_names: string[] | null;
    }> | null;
    dependencies_sub: number | null;
    dependencies_declared_count: number | null;
    mode: 'blended' | 'practices_only' | 'yoy_only' | 'positive_only' | 'no_data';
    weights: { practices: number; yoy: number; positive: number; dependencies: number };
    source: { name: string; doi: string };
  } | null;
  // Overall (legacy 4-pillar environmental)
  pillarScores?: {
    climate: number | null;
    water: number | null;
    circularity: number | null;
    nature: number | null;
  };
  // ESG composite (new)
  esgScores?: {
    e: number | null;
    s: number | null;
    g: number | null;
  };
  esgWeights?: { e: number; s: number; g: number };
  // Environmental ESG sub-pillar (re-uses pillarScores above)
  // Social sub-pillars
  socialScores?: {
    community: number | null;
    people_culture: number | null;
    supplier_esg: number | null;
  };
  // Governance sub-pillars
  governanceScores?: {
    governance: number | null;
    certifications: number | null;
  };
}

interface ScoreExplainerProps {
  scoreType: ScoreType;
  currentScore: number | null;
  benchmark?: {
    platform_average?: number;
    category_average?: number;
    category_name?: string;
    top_performer?: number;
  };
  calculationInputs?: CalculationInputs;
  className?: string;
}

const scoreTypeConfig: Record<ScoreType, {
  title: string;
  description: string;
  methodology: string;
  bands: Array<{ min: number; label: string; color: string; description: string }>;
  weight?: string;
}> = {
  overall: {
    title: 'Company Vitality Score',
    description: 'A holistic measure of your sustainability performance across four key environmental pillars',
    methodology: 'Weighted average of Climate (30%), Water (25%), Circularity (25%), and Nature (20%) pillar scores',
    bands: [
      { min: 85, label: 'Excellent', color: 'green', description: 'Sustainability leader with best-in-class performance' },
      { min: 70, label: 'Healthy', color: 'emerald', description: 'Strong performance across all pillars' },
      { min: 50, label: 'Developing', color: 'amber', description: 'Good progress with opportunities to improve' },
      { min: 30, label: 'Emerging', color: 'orange', description: 'Early stage - focused action drives quick gains' },
      { min: 0, label: 'Needs Attention', color: 'red', description: 'Significant opportunities for improvement' },
    ],
  },
  climate: {
    title: 'Climate Score',
    description: 'Measures your greenhouse gas emissions performance relative to industry benchmarks',
    methodology: 'Based on emissions intensity (tCO2eq per product) compared to industry average. Considers Scope 1, 2, and 3 emissions.',
    weight: '30%',
    bands: [
      { min: 85, label: 'Industry Leader', color: 'green', description: '≤70% of industry benchmark - exceptional performance' },
      { min: 70, label: 'Above Average', color: 'emerald', description: '70-100% of benchmark - strong carbon management' },
      { min: 50, label: 'Average', color: 'amber', description: '100-130% of benchmark - meets standards' },
      { min: 30, label: 'Below Average', color: 'orange', description: '>130% of benchmark - improvement needed' },
      { min: 0, label: 'Action Required', color: 'red', description: 'Significantly above benchmark - urgent action' },
    ],
  },
  water: {
    title: 'Water Score',
    description: 'Evaluates water consumption and scarcity risk across your operations and supply chain',
    methodology: 'Based on water risk assessment combining consumption volume with location-based scarcity factors',
    weight: '25%',
    bands: [
      { min: 85, label: 'Low Risk', color: 'green', description: 'Operations in low water stress areas' },
      { min: 60, label: 'Medium Risk', color: 'amber', description: 'Some facilities in moderate stress areas' },
      { min: 35, label: 'High Risk', color: 'orange', description: 'Operations in high water stress regions' },
      { min: 0, label: 'Critical Risk', color: 'red', description: 'Significant exposure to water scarcity' },
    ],
  },
  circularity: {
    title: 'Circularity Score',
    description: 'Measures waste diversion from landfill and circular economy practices',
    methodology: 'Based on waste diversion rate: percentage of waste recycled, composted, or recovered vs. landfilled',
    weight: '25%',
    bands: [
      { min: 95, label: 'Circular Leader', color: 'green', description: '≥80% waste diversion - near zero waste' },
      { min: 80, label: 'Strong', color: 'emerald', description: '60-79% diversion - robust recycling programs' },
      { min: 60, label: 'Developing', color: 'amber', description: '40-59% diversion - good progress' },
      { min: 40, label: 'Basic', color: 'orange', description: '20-39% diversion - systems in place' },
      { min: 0, label: 'Linear', color: 'red', description: '<20% diversion - linear economy model' },
    ],
  },
  nature: {
    title: 'Nature Score',
    description: 'Assesses land use and biodiversity impacts from your operations and supply chain',
    methodology: 'Based on land use intensity and biodiversity risk from agricultural sourcing and site locations',
    weight: '20%',
    bands: [
      { min: 80, label: 'Low Impact', color: 'green', description: 'Minimal land use and biodiversity risk' },
      { min: 55, label: 'Moderate Impact', color: 'amber', description: 'Average land use intensity' },
      { min: 30, label: 'High Impact', color: 'orange', description: 'Significant land transformation' },
      { min: 0, label: 'Critical Impact', color: 'red', description: 'Major biodiversity concerns' },
    ],
  },
  composite: {
    title: 'Company Vitality Score (ESG)',
    description: 'A holistic ESG measure of your sustainability performance across environmental, social, and governance pillars.',
    methodology: 'Weighted average of E, S, G pillar scores. Default weighting is E 50% / S 25% / G 25%; org admins can adjust.',
    bands: [
      { min: 85, label: 'Excellent', color: 'green', description: 'Sustainability leader across the board.' },
      { min: 70, label: 'Healthy', color: 'emerald', description: 'Strong performance across most pillars.' },
      { min: 50, label: 'Developing', color: 'amber', description: 'Good progress with clear room to push.' },
      { min: 30, label: 'Emerging', color: 'orange', description: 'Early stage. Focused action moves things fast.' },
      { min: 0, label: 'Needs Attention', color: 'red', description: 'Significant opportunities to improve.' },
    ],
  },
  environmental: {
    title: 'Environmental Score',
    description: 'Composite of climate, water, circularity, and nature pillar scores.',
    methodology: 'Weighted average: Climate 30%, Water 25%, Circularity 25%, Nature 20%. Missing pillars are dropped and the others re-normalised.',
    weight: '50% of ESG (default)',
    bands: [
      { min: 85, label: 'Excellent', color: 'green', description: 'Industry-leading environmental footprint.' },
      { min: 70, label: 'Healthy', color: 'emerald', description: 'Solid performance across most env pillars.' },
      { min: 50, label: 'Developing', color: 'amber', description: 'Good progress with room to improve.' },
      { min: 30, label: 'Emerging', color: 'orange', description: 'Early stage on environmental measurement.' },
      { min: 0, label: 'Needs Attention', color: 'red', description: 'Significant environmental gaps.' },
    ],
  },
  social: {
    title: 'Social Score',
    description: 'Composite of community impact, people & culture, and supplier ESG signals.',
    methodology: 'Equal-weight average of available sub-scores: Community Impact, People & Culture, Supplier ESG submission rate. Missing inputs are dropped.',
    weight: '25% of ESG (default)',
    bands: [
      { min: 85, label: 'Excellent', color: 'green', description: 'Strong social performance across the board.' },
      { min: 70, label: 'Healthy', color: 'emerald', description: 'Solid social engagement signals.' },
      { min: 50, label: 'Developing', color: 'amber', description: 'Good progress, more to do.' },
      { min: 30, label: 'Emerging', color: 'orange', description: 'Early-stage social programmes.' },
      { min: 0, label: 'Needs Attention', color: 'red', description: 'Material social gaps to address.' },
    ],
  },
  governance: {
    title: 'Governance Score',
    description: 'Composite of governance practices and certifications progress.',
    methodology: 'Weighted: Governance practices (policies, board, ethics, transparency) 85%, certification progress 15%.',
    weight: '25% of ESG (default)',
    bands: [
      { min: 85, label: 'Excellent', color: 'green', description: 'Governance practices in great shape.' },
      { min: 70, label: 'Healthy', color: 'emerald', description: 'Solid governance foundations.' },
      { min: 50, label: 'Developing', color: 'amber', description: 'Several controls in place, gaps remain.' },
      { min: 30, label: 'Emerging', color: 'orange', description: 'Limited governance visibility.' },
      { min: 0, label: 'Needs Attention', color: 'red', description: 'Significant governance work needed.' },
    ],
  },
};

function getImprovementGuidance(scoreType: ScoreType, currentScore: number | null, inputs?: CalculationInputs): string | null {
  if (currentScore === null) return null;

  const config = scoreTypeConfig[scoreType];
  // Find the next band above current score
  const sortedBands = [...config.bands].sort((a, b) => a.min - b.min);
  const nextBand = sortedBands.find(band => band.min > currentScore);

  if (!nextBand) return 'You are in the highest score band. Maintain your current practices to stay at the top.';

  switch (scoreType) {
    case 'climate': {
      const ratio = inputs?.intensityRatio;
      if (ratio !== undefined) {
        if (nextBand.min >= 85) return `Reduce your emissions intensity ratio below 0.70x the industry benchmark to reach "${nextBand.label}" (currently ${ratio.toFixed(2)}x).`;
        if (nextBand.min >= 70) return `Reduce your emissions intensity ratio below 0.85x the industry benchmark to reach "${nextBand.label}" (currently ${ratio.toFixed(2)}x).`;
        if (nextBand.min >= 50) return `Reduce your emissions intensity ratio to 1.0x or below the industry benchmark to reach "${nextBand.label}" (currently ${ratio.toFixed(2)}x).`;
      }
      return `Reduce your emissions intensity to reach "${nextBand.label}" (score ${nextBand.min}+).`;
    }
    case 'water':
      if (inputs?.waterRiskLevel === 'high') return `Move operations to lower water stress areas or implement water recycling to reach "${nextBand.label}".`;
      if (inputs?.waterRiskLevel === 'medium') return `Reducing water risk from Medium to Low would increase your score from 60 to 85.`;
      return `Improve your water risk assessment to reach "${nextBand.label}" (score ${nextBand.min}+).`;
    case 'circularity':
      if (inputs?.circularityRate !== undefined) {
        const targetRate = nextBand.min >= 95 ? 80 : nextBand.min >= 80 ? 60 : nextBand.min >= 60 ? 40 : 20;
        return `Increase your waste diversion rate from ${inputs.circularityRate.toFixed(0)}% to ${targetRate}%+ to reach "${nextBand.label}".`;
      }
      return `Increase your waste diversion rate to reach "${nextBand.label}" (score ${nextBand.min}+).`;
    case 'nature':
      if (inputs?.biodiversityRisk === 'high') return `Reduce biodiversity risk through sustainable sourcing practices to reach "${nextBand.label}".`;
      if (inputs?.biodiversityRisk === 'medium') return `Reducing biodiversity risk from Medium to Low would increase your score from 55 to 80.`;
      return `Improve your land use and biodiversity impact to reach "${nextBand.label}" (score ${nextBand.min}+).`;
    case 'overall': {
      // Find the weakest pillar
      if (inputs?.pillarScores) {
        const pillars = [
          { name: 'Climate', score: inputs.pillarScores.climate, weight: 30 },
          { name: 'Water', score: inputs.pillarScores.water, weight: 25 },
          { name: 'Circularity', score: inputs.pillarScores.circularity, weight: 25 },
          { name: 'Nature', score: inputs.pillarScores.nature, weight: 20 },
        ];
        const nullPillars = pillars.filter(p => p.score === null);
        if (nullPillars.length > 0) {
          return `Add data for ${nullPillars.map(p => p.name).join(', ')} to get a more complete score. Missing pillars mean available weights are redistributed.`;
        }
        const weakest = pillars
          .filter(p => p.score !== null)
          .sort((a, b) => (a.score || 0) - (b.score || 0))[0];
        if (weakest) {
          return `Focus on improving your ${weakest.name} score (${weakest.score}) for the biggest impact on your overall score.`;
        }
      }
      return `Improve your weakest pillar to increase your overall score to ${nextBand.min}+ ("${nextBand.label}").`;
    }
    case 'composite': {
      if (inputs?.esgScores) {
        const pillars = [
          { name: 'Environmental', score: inputs.esgScores.e },
          { name: 'Social', score: inputs.esgScores.s },
          { name: 'Governance', score: inputs.esgScores.g },
        ];
        const nullPillars = pillars.filter(p => p.score === null);
        if (nullPillars.length > 0) {
          return `Add ${nullPillars.map(p => p.name).join(' / ')} data to firm up the composite. Missing pillars get their weight redistributed.`;
        }
        const weakest = pillars
          .filter(p => p.score !== null)
          .sort((a, b) => (a.score || 0) - (b.score || 0))[0];
        if (weakest) {
          return `Your weakest pillar is ${weakest.name} at ${weakest.score}. Lifting that has the biggest pull on the composite.`;
        }
      }
      return `Improve your weakest ESG pillar to push the composite to "${nextBand.label}" (${nextBand.min}+).`;
    }
    case 'environmental': {
      if (inputs?.pillarScores) {
        const subs = [
          { name: 'Climate', score: inputs.pillarScores.climate },
          { name: 'Water', score: inputs.pillarScores.water },
          { name: 'Circularity', score: inputs.pillarScores.circularity },
          { name: 'Nature', score: inputs.pillarScores.nature },
        ];
        const nullSubs = subs.filter(p => p.score === null);
        if (nullSubs.length > 0) {
          return `Add ${nullSubs.map(s => s.name).join(', ')} data to make Environmental more complete.`;
        }
        const weakest = subs
          .filter(p => p.score !== null)
          .sort((a, b) => (a.score || 0) - (b.score || 0))[0];
        if (weakest) {
          return `Within Environmental, ${weakest.name} (${weakest.score}) is the lowest. That's where the upside is.`;
        }
      }
      return `Reach "${nextBand.label}" by improving your weakest environmental sub-pillar.`;
    }
    case 'social': {
      if (inputs?.socialScores) {
        const subs = [
          { name: 'Community impact', score: inputs.socialScores.community },
          { name: 'People & culture', score: inputs.socialScores.people_culture },
          { name: 'Supplier ESG', score: inputs.socialScores.supplier_esg },
        ];
        const nullSubs = subs.filter(p => p.score === null);
        if (nullSubs.length > 0) {
          return `Add data for ${nullSubs.map(s => s.name).join(', ')} to lift the Social pillar.`;
        }
        const weakest = subs
          .filter(p => p.score !== null)
          .sort((a, b) => (a.score || 0) - (b.score || 0))[0];
        if (weakest) {
          return `Within Social, ${weakest.name} (${weakest.score}) is the lowest. That's where the upside is.`;
        }
      }
      return `Lift Social to "${nextBand.label}" by working your weakest sub-pillar (community / people / suppliers).`;
    }
    case 'governance': {
      if (inputs?.governanceScores) {
        const g = inputs.governanceScores.governance;
        const c = inputs.governanceScores.certifications;
        if (g === null && c === null) {
          return 'Add governance policies, board records, or certifications progress to unlock the Governance pillar.';
        }
        if (g !== null && (c === null || c < (g ?? 0))) {
          return `Make progress on certifications (B Corp, SBTi, ISO) to round out Governance — currently ${c ?? 'no'} cert progress data.`;
        }
        return `Tighten governance practices (policies, board independence, ethics records) to push Governance to "${nextBand.label}".`;
      }
      return `Reach "${nextBand.label}" by tightening governance practices and progressing your certifications.`;
    }
    default:
      return null;
  }
}

function buildRosaPrompt(scoreType: ScoreType, currentScore: number | null, inputs?: CalculationInputs): string {
  const parts: string[] = [];

  if (scoreType === 'overall' && inputs?.pillarScores) {
    const ps = inputs.pillarScores;
    parts.push(`Explain my Company Vitality Score of ${currentScore ?? 'N/A'}.`);
    parts.push(`My pillar scores are: Climate ${ps.climate ?? 'no data'}, Water ${ps.water ?? 'no data'}, Circularity ${ps.circularity ?? 'no data'}, Nature ${ps.nature ?? 'no data'}.`);
    parts.push('The weights are Climate 30%, Water 25%, Circularity 25%, Nature 20%.');
  } else if (scoreType === 'climate') {
    parts.push(`Explain my Climate Score of ${currentScore ?? 'N/A'}.`);
    if (inputs?.totalEmissions) parts.push(`My total emissions are ${(inputs.totalEmissions / 1000).toFixed(1)} tCO2e.`);
    if (inputs?.intensityRatio !== undefined) parts.push(`My emissions intensity ratio vs industry benchmark is ${inputs.intensityRatio.toFixed(2)}x.`);
  } else if (scoreType === 'water') {
    parts.push(`Explain my Water Score of ${currentScore ?? 'N/A'}.`);
    if (inputs?.waterRiskLevel) parts.push(`My water risk level is ${inputs.waterRiskLevel}.`);
    if (inputs?.waterConsumption) parts.push(`My water consumption is ${inputs.waterConsumption.toFixed(0)} m3.`);
  } else if (scoreType === 'circularity') {
    parts.push(`Explain my Circularity Score of ${currentScore ?? 'N/A'}.`);
    if (inputs?.circularityRate !== undefined) parts.push(`My waste diversion rate is ${inputs.circularityRate.toFixed(0)}%.`);
  } else if (scoreType === 'nature') {
    parts.push(`Explain my Nature Score of ${currentScore ?? 'N/A'}.`);
    if (inputs?.biodiversityRisk) parts.push(`My biodiversity risk level is ${inputs.biodiversityRisk}.`);
    if (inputs?.landUse) parts.push(`My land use is ${inputs.landUse.toFixed(0)} m2 crop eq.`);
  } else if (scoreType === 'composite' && inputs?.esgScores) {
    parts.push(`Explain my ESG composite vitality score of ${currentScore ?? 'N/A'}.`);
    parts.push(`My pillar scores are: Environmental ${inputs.esgScores.e ?? 'no data'}, Social ${inputs.esgScores.s ?? 'no data'}, Governance ${inputs.esgScores.g ?? 'no data'}.`);
    if (inputs.esgWeights) {
      parts.push(
        `Weights: E ${Math.round(inputs.esgWeights.e * 100)}% / S ${Math.round(inputs.esgWeights.s * 100)}% / G ${Math.round(inputs.esgWeights.g * 100)}%.`,
      );
    }
  } else if (scoreType === 'environmental' && inputs?.pillarScores) {
    parts.push(`Explain my Environmental score of ${currentScore ?? 'N/A'}.`);
    const ps = inputs.pillarScores;
    parts.push(`Sub-pillars: Climate ${ps.climate ?? 'no data'}, Water ${ps.water ?? 'no data'}, Circularity ${ps.circularity ?? 'no data'}, Nature ${ps.nature ?? 'no data'}.`);
  } else if (scoreType === 'social' && inputs?.socialScores) {
    parts.push(`Explain my Social score of ${currentScore ?? 'N/A'}.`);
    const ss = inputs.socialScores;
    parts.push(`Sub-pillars: Community impact ${ss.community ?? 'no data'}, People & culture ${ss.people_culture ?? 'no data'}, Supplier ESG ${ss.supplier_esg ?? 'no data'}.`);
  } else if (scoreType === 'governance' && inputs?.governanceScores) {
    parts.push(`Explain my Governance score of ${currentScore ?? 'N/A'}.`);
    const gs = inputs.governanceScores;
    parts.push(`Governance practices ${gs.governance ?? 'no data'}, certifications progress ${gs.certifications ?? 'no data'}.`);
  }

  parts.push('What does this score mean, and what specific actions should I take to improve it?');
  return parts.join(' ');
}

function formatNatureValue(value: number): string {
  if (value === 0) return '0';
  if (Math.abs(value) >= 1000) return value.toFixed(0);
  if (Math.abs(value) >= 1) return value.toFixed(1);
  if (Math.abs(value) >= 0.01) return value.toFixed(2);
  return value.toExponential(1);
}

function CalculationBreakdown({ scoreType, inputs }: { scoreType: ScoreType; inputs: CalculationInputs }) {
  if (scoreType === 'overall' && inputs.pillarScores) {
    const ps = inputs.pillarScores;
    const pillars = [
      { name: 'Climate', score: ps.climate, weight: 0.30 },
      { name: 'Water', score: ps.water, weight: 0.25 },
      { name: 'Circularity', score: ps.circularity, weight: 0.25 },
      { name: 'Nature', score: ps.nature, weight: 0.20 },
    ];
    const available = pillars.filter(p => p.score !== null);
    const totalWeight = available.reduce((sum, p) => sum + p.weight, 0);

    return (
      <div className="space-y-1.5">
        {pillars.map((p) => {
          const adjustedWeight = p.score !== null ? ((p.weight / totalWeight) * 100).toFixed(0) : null;
          const contribution = p.score !== null ? ((p.score * p.weight / totalWeight)).toFixed(1) : null;
          return (
            <div key={p.name} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{p.name} ({(p.weight * 100).toFixed(0)}%)</span>
              {p.score !== null ? (
                <span className="font-medium tabular-nums">
                  {p.score} x {adjustedWeight}% = <span className="text-foreground">{contribution} pts</span>
                </span>
              ) : (
                <span className="text-muted-foreground italic">No data</span>
              )}
            </div>
          );
        })}
        {available.length < 4 && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Weights redistributed across {available.length} available pillar{available.length !== 1 ? 's' : ''}.
          </p>
        )}
      </div>
    );
  }

  if (scoreType === 'climate') {
    // New blended breakdown path: shows users the exact sub-scores and how
    // the blend was reached. Renders when the breakdown is provided.
    const cb = inputs.climateBreakdown;
    if (cb) {
      const modeLabel: Record<typeof cb.mode, string> = {
        blended: 'Blended (intensity + year-on-year)',
        intensity_only: 'Intensity only (no prior-year data yet)',
        yoy_only: 'Year-on-year only (no benchmark coverage)',
        no_data: 'Awaiting data',
      };
      return (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">How it&apos;s scored</span>
            <span className="font-medium text-right">{modeLabel[cb.mode]}</span>
          </div>
          {cb.intensity_sub !== null && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Intensity vs benchmark{cb.mode === 'blended' ? ` (${Math.round(cb.weights.intensity * 100)}% weight)` : ''}
              </span>
              <span className="font-medium tabular-nums">{cb.intensity_sub} / 100</span>
            </div>
          )}
          {cb.yoy_sub !== null && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Year-on-year emissions{cb.mode === 'blended' ? ` (${Math.round(cb.weights.yoy * 100)}% weight)` : ''}
              </span>
              <span className="font-medium tabular-nums">{cb.yoy_sub} / 100</span>
            </div>
          )}
          {cb.score !== null && cb.mode === 'blended' && (
            <div className="flex items-center justify-between text-xs border-t pt-1.5 mt-1.5">
              <span className="text-muted-foreground">Blended score</span>
              <span className="font-semibold tabular-nums">{cb.score} / 100</span>
            </div>
          )}
          {inputs.benchmarkSource && (
            <div className="flex items-center justify-between text-xs border-t pt-1.5 mt-1.5">
              <span className="text-muted-foreground">
                {inputs.benchmarkSource.category ? `Benchmark source (${inputs.benchmarkSource.category})` : 'Benchmark source'}
              </span>
              <a
                href={inputs.benchmarkSource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 max-w-[180px] truncate"
              >
                {inputs.benchmarkSource.name} ({inputs.benchmarkSource.year})
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </a>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Climate is scored per unit (whole product, packaging included), benchmarked against industry data weighted by your product mix and units produced. The year-on-year line rewards absolute reductions: a 10% drop earns full marks because it beats Paris-aligned trajectories.
          </p>
        </div>
      );
    }

    // Legacy path (kept until all callers migrate to climateBreakdown).
    return (
      <div className="space-y-1.5">
        {inputs.totalEmissions !== undefined && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Total emissions</span>
            <span className="font-medium tabular-nums">{(inputs.totalEmissions / 1000).toFixed(1)} tCO2e</span>
          </div>
        )}
        {inputs.emissionsIntensity !== undefined && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Emissions intensity</span>
            <span className="font-medium tabular-nums">{inputs.emissionsIntensity.toFixed(1)} kgCO2e/product</span>
          </div>
        )}
        {inputs.industryBenchmark !== undefined && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Industry benchmark</span>
            <span className="font-medium tabular-nums">{inputs.industryBenchmark.toFixed(1)} kgCO2e/product</span>
          </div>
        )}
        {inputs.benchmarkSource && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {inputs.benchmarkSource.category ? `Source (${inputs.benchmarkSource.category})` : 'Source'}
            </span>
            <a
              href={inputs.benchmarkSource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 max-w-[180px] truncate"
            >
              {inputs.benchmarkSource.name} ({inputs.benchmarkSource.year})
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
            </a>
          </div>
        )}
        {inputs.intensityRatio !== undefined && (
          <div className="flex items-center justify-between text-xs border-t pt-1.5 mt-1.5">
            <span className="text-muted-foreground">Intensity ratio</span>
            <span className="font-medium tabular-nums">{inputs.intensityRatio.toFixed(2)}x benchmark</span>
          </div>
        )}
      </div>
    );
  }

  if (scoreType === 'water') {
    // New blended breakdown path. Renders when the breakdown is provided.
    const wb = inputs.waterBreakdown;
    if (wb) {
      const modeLabel: Record<typeof wb.mode, string> = {
        blended: 'Blended (intensity + year-on-year)',
        intensity_only: 'Intensity only (no prior-year data yet)',
        yoy_only: 'Year-on-year only (no benchmark coverage)',
        no_data: 'Awaiting data',
      };
      const scarcityBand =
        wb.avg_scarcity_factor === null
          ? null
          : wb.avg_scarcity_factor > 40
            ? 'highly stressed'
            : wb.avg_scarcity_factor > 20
              ? 'moderately stressed'
              : 'low-stress';
      return (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">How it&apos;s scored</span>
            <span className="font-medium text-right">{modeLabel[wb.mode]}</span>
          </div>
          {wb.intensity_sub !== null && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Intensity vs benchmark{wb.mode === 'blended' ? ` (${Math.round(wb.weights.intensity * 100)}% weight)` : ''}
              </span>
              <span className="font-medium tabular-nums">{wb.intensity_sub} / 100</span>
            </div>
          )}
          {wb.yoy_sub !== null && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Year-on-year withdrawal{wb.mode === 'blended' ? ` (${Math.round(wb.weights.yoy * 100)}% weight)` : ''}
              </span>
              <span className="font-medium tabular-nums">{wb.yoy_sub} / 100</span>
            </div>
          )}
          {wb.score !== null && wb.mode === 'blended' && (
            <div className="flex items-center justify-between text-xs border-t pt-1.5 mt-1.5">
              <span className="text-muted-foreground">Blended score</span>
              <span className="font-semibold tabular-nums">{wb.score} / 100</span>
            </div>
          )}
          {scarcityBand && (
            <div className="flex items-center justify-between text-xs border-t pt-1.5 mt-1.5">
              <span className="text-muted-foreground">Local scarcity context</span>
              <Badge variant="outline" className="text-[10px] h-5 capitalize">
                {scarcityBand} (AWARE {wb.avg_scarcity_factor!.toFixed(0)})
              </Badge>
            </div>
          )}
          {wb.source && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Data source</span>
              <span className="font-medium">
                {wb.source === 'facility' ? 'Facility-tracked withdrawal' : 'LCA water (proxy)'}
              </span>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Water is scored per unit (whole product, packaging included), benchmarked against BIER industry data and weighted by your product mix and units produced. Year-on-year reductions are rewarded heavily because cutting water use is structurally hard. Local scarcity is shown as context only — the score doesn&apos;t penalise where you operate, but reductions in stressed watersheds are extra valuable.
          </p>
        </div>
      );
    }

    // Legacy path (kept until all callers migrate to waterBreakdown).
    return (
      <div className="space-y-1.5">
        {inputs.waterRiskLevel && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Water risk level</span>
            <Badge variant="outline" className="text-[10px] h-5 capitalize">{inputs.waterRiskLevel}</Badge>
          </div>
        )}
        {inputs.waterConsumption !== undefined && inputs.waterConsumption > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Water consumption</span>
            <span className="font-medium tabular-nums">
              {inputs.waterConsumption >= 1000
                ? `${(inputs.waterConsumption / 1000).toFixed(1)}k`
                : inputs.waterConsumption.toFixed(0)} m3
            </span>
          </div>
        )}
      </div>
    );
  }

  if (scoreType === 'circularity') {
    const cb = inputs.circularityBreakdown;
    if (cb) {
      const modeLabel: Record<typeof cb.mode, string> = {
        blended: 'Blended (circular practices + waste-intensity trend)',
        practices_only: 'Circular practices only (no prior-year waste data yet)',
        yoy_only: 'Trend only (no input/output ratios available)',
        no_data: 'Awaiting data',
      };
      const formatPct = (v: number) => `${Math.round(v * 100)}%`;
      // Show the top routes (proportions ≥ 1%) for the treatment mix.
      const mixOrder: Array<[keyof typeof cb.treatment_mix, string]> = [
        ['reuse', 'Reuse'],
        ['composting', 'Composting'],
        ['anaerobic_digestion', 'Anaerobic digestion'],
        ['recycling', 'Recycling'],
        ['incineration_with_recovery', 'Energy recovery'],
        ['landfill', 'Landfill'],
        ['incineration_without_recovery', 'Incineration (no recovery)'],
        ['other', 'Other'],
      ];
      const topRoutes = mixOrder.filter(([key]) => cb.treatment_mix[key] >= 0.01);
      return (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">How it&apos;s scored</span>
            <span className="font-medium text-right">{modeLabel[cb.mode]}</span>
          </div>
          {cb.practices_sub !== null && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Circular practices{cb.mode === 'blended' ? ` (${Math.round(cb.weights.practices * 100)}% weight)` : ''}
              </span>
              <span className="font-medium tabular-nums">{cb.practices_sub} / 100</span>
            </div>
          )}
          {cb.axes.recycled_content_sub !== null && (
            <div className="flex items-center justify-between text-[11px] pl-3">
              <span className="text-muted-foreground">↳ Recycled content (inputs)</span>
              <span className="tabular-nums">{cb.axes.recycled_content_sub} / 100</span>
            </div>
          )}
          {cb.axes.packaging_recyclability_sub !== null && (
            <div className="flex items-center justify-between text-[11px] pl-3">
              <span className="text-muted-foreground">↳ Packaging recyclability (outputs)</span>
              <span className="tabular-nums">{cb.axes.packaging_recyclability_sub} / 100</span>
            </div>
          )}
          {cb.axes.diversion_sub !== null && (
            <div className="flex items-center justify-between text-[11px] pl-3">
              <span className="text-muted-foreground">↳ Tier-weighted diversion</span>
              <span className="tabular-nums">{cb.axes.diversion_sub} / 100</span>
            </div>
          )}
          {cb.intensity_yoy_sub !== null && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Waste-intensity year-on-year{cb.mode === 'blended' ? ` (${Math.round(cb.weights.yoy * 100)}% weight)` : ''}
              </span>
              <span className="font-medium tabular-nums">{cb.intensity_yoy_sub} / 100</span>
            </div>
          )}
          {cb.score !== null && cb.mode === 'blended' && (
            <div className="flex items-center justify-between text-xs border-t pt-1.5 mt-1.5">
              <span className="text-muted-foreground">Blended score</span>
              <span className="font-semibold tabular-nums">{cb.score} / 100</span>
            </div>
          )}
          {topRoutes.length > 0 && (
            <div className="border-t pt-1.5 mt-1.5">
              <p className="text-[10px] text-muted-foreground mb-1">Where your waste goes</p>
              {topRoutes.map(([key, label]) => (
                <div key={key} className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="tabular-nums">{formatPct(cb.treatment_mix[key])}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Circularity blends the quality of your practices (% recycled content in, % packaging recyclable out, and how high up the EU waste hierarchy your operational waste goes — reuse beats energy recovery beats landfill) with the year-on-year change in waste per unit produced. Reductions in waste intensity are rewarded; better disposal routes lift the score even at the same diversion rate.
          </p>
        </div>
      );
    }

    // Legacy path (kept until all callers migrate).
    return (
      <div className="space-y-1.5">
        {inputs.circularityRate !== undefined && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Waste diversion rate</span>
            <span className="font-medium tabular-nums">{inputs.circularityRate.toFixed(0)}%</span>
          </div>
        )}
      </div>
    );
  }

  if (scoreType === 'nature') {
    const nb = inputs.natureBreakdown;
    if (nb) {
      const modeLabel: Record<typeof nb.mode, string> = {
        blended: nb.nature_positive_sub !== null
          ? 'Blended (impacts + year-on-year + nature-positive)'
          : 'Blended (impacts + year-on-year)',
        practices_only: 'Per-unit impacts only (no prior-year data yet)',
        yoy_only: 'Year-on-year only (no per-unit data)',
        positive_only: 'Nature-positive actions only (no LCA data yet)',
        no_data: 'Awaiting data',
      };
      // EF 3.1 weights re-normalised to nature pillar (sum to 1.0).
      const axisWeights = {
        land_use: 42,
        terrestrial_acidification: 33,
        freshwater_eutrophication: 15,
        terrestrial_ecotoxicity: 10,
      };
      const axisRows: Array<[
        string,
        number | null,
        number | null,
        string,
        number,
      ]> = [
        ['Land use', nb.axes.land_use_sub, nb.per_unit.land_use, 'm²a/unit', axisWeights.land_use],
        [
          'Terrestrial acidification',
          nb.axes.terrestrial_acidification_sub,
          nb.per_unit.terrestrial_acidification,
          'kg SO₂/unit',
          axisWeights.terrestrial_acidification,
        ],
        [
          'Freshwater eutrophication',
          nb.axes.freshwater_eutrophication_sub,
          nb.per_unit.freshwater_eutrophication,
          'kg P eq/unit',
          axisWeights.freshwater_eutrophication,
        ],
        [
          'Terrestrial ecotoxicity',
          nb.axes.terrestrial_ecotoxicity_sub,
          nb.per_unit.terrestrial_ecotoxicity,
          'kg DCB eq/unit',
          axisWeights.terrestrial_ecotoxicity,
        ],
      ];
      return (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">How it&apos;s scored</span>
            <span className="font-medium text-right">{modeLabel[nb.mode]}</span>
          </div>
          {nb.practices_sub !== null && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                EF 3.1 weighted impacts{nb.mode === 'blended' ? ` (${Math.round(nb.weights.practices * 100)}% weight)` : ''}
              </span>
              <span className="font-medium tabular-nums">{nb.practices_sub} / 100</span>
            </div>
          )}
          {axisRows.map(([label, sub, perUnit, unit, weight]) =>
            sub === null ? null : (
              <div key={label} className="flex items-center justify-between text-[11px] pl-3">
                <span className="text-muted-foreground">
                  ↳ {label} <span className="text-muted-foreground/60">({weight}%)</span>
                </span>
                <span className="tabular-nums">
                  {sub} / 100
                  {perUnit !== null && (
                    <span className="text-muted-foreground/60 ml-1.5">
                      ({formatNatureValue(perUnit)} {unit})
                    </span>
                  )}
                </span>
              </div>
            ),
          )}
          {nb.yoy_sub !== null && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Year-on-year footprint ({Math.round(nb.weights.yoy * 100)}% weight)
              </span>
              <span className="font-medium tabular-nums">{nb.yoy_sub} / 100</span>
            </div>
          )}
          {nb.nature_positive_sub !== null && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Nature-positive actions ({Math.round(nb.weights.positive * 100)}% weight)
              </span>
              <span className="font-medium tabular-nums">
                {nb.nature_positive_sub} / 100
                {nb.effective_hectares !== null && (
                  <span className="text-muted-foreground/60 ml-1.5">
                    ({nb.effective_hectares.toFixed(1)} effective ha)
                  </span>
                )}
              </span>
            </div>
          )}
          {nb.dependencies_sub !== null && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Dependency disclosure (10% weight)
              </span>
              <span className="font-medium tabular-nums">
                {nb.dependencies_sub} / 100
                {nb.dependencies_declared_count !== null && (
                  <span className="text-muted-foreground/60 ml-1.5">
                    ({nb.dependencies_declared_count} declared)
                  </span>
                )}
              </span>
            </div>
          )}
          {nb.score !== null && nb.mode === 'blended' && (
            <div className="flex items-center justify-between text-xs border-t pt-1.5 mt-1.5">
              <span className="text-muted-foreground">Final score</span>
              <span className="font-semibold tabular-nums">{nb.score} / 100</span>
            </div>
          )}
          {nb.country_biodiversity_multiplier !== null && nb.country_mix && nb.country_mix.length > 0 && (
            <div className="border-t pt-1.5 mt-1.5">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">
                  Country biodiversity multiplier (applied to land use)
                </span>
                <span className="font-medium tabular-nums">
                  {nb.country_biodiversity_multiplier.toFixed(2)}×
                </span>
              </div>
              {nb.country_mix.slice(0, 5).map(c => (
                <div key={c.country_code} className="flex items-center justify-between text-[11px] pl-3">
                  <span className="text-muted-foreground truncate">
                    {c.country_name}
                    {c.hotspot_names && c.hotspot_names.length > 0 && (
                      <span className="text-emerald-300/70 ml-1">(hotspot)</span>
                    )}
                  </span>
                  <span className="tabular-nums">
                    {c.share_pct.toFixed(0)}% · {c.multiplier.toFixed(2)}×
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between text-xs border-t pt-1.5 mt-1.5">
            <span className="text-muted-foreground">Methodology</span>
            <a
              href={nb.source.doi}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              {nb.source.name}
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
            </a>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Nature is scored against the EU&apos;s EF 3.1 framework — the methodology behind PEF and recognised by TNFD. Each axis (land use, acidification, eutrophication, ecotoxicity) is rated against published thresholds, then weighted by EF 3.1&apos;s contribution-to-single-score factors. Acidification weighs higher than pure biodiversity framing alone would suggest because EF 3.1 also captures soil chemistry, forest dieback, and respiratory-health effects from precursor emissions.
          </p>
        </div>
      );
    }

    // Legacy path (kept until all callers migrate).
    return (
      <div className="space-y-1.5">
        {inputs.biodiversityRisk && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Biodiversity risk</span>
            <Badge variant="outline" className="text-[10px] h-5 capitalize">{inputs.biodiversityRisk}</Badge>
          </div>
        )}
        {inputs.landUse !== undefined && inputs.landUse > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Land use impact</span>
            <span className="font-medium tabular-nums">{inputs.landUse.toFixed(0)} m2 crop eq</span>
          </div>
        )}
      </div>
    );
  }

  if (scoreType === 'composite' && inputs.esgScores && inputs.esgWeights) {
    const w = inputs.esgWeights;
    const pillars = [
      { name: 'Environmental', score: inputs.esgScores.e, weight: w.e },
      { name: 'Social', score: inputs.esgScores.s, weight: w.s },
      { name: 'Governance', score: inputs.esgScores.g, weight: w.g },
    ];
    const available = pillars.filter(p => p.score !== null);
    const totalWeight = available.reduce((sum, p) => sum + p.weight, 0);
    return (
      <div className="space-y-1.5">
        {pillars.map(p => {
          const adjustedPct =
            p.score !== null && totalWeight > 0
              ? ((p.weight / totalWeight) * 100).toFixed(0)
              : null;
          const contribution =
            p.score !== null && totalWeight > 0
              ? ((p.score * p.weight) / totalWeight).toFixed(1)
              : null;
          return (
            <div key={p.name} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {p.name} ({(p.weight * 100).toFixed(0)}%)
              </span>
              {p.score !== null ? (
                <span className="font-medium tabular-nums">
                  {p.score} x {adjustedPct}% = <span className="text-foreground">{contribution} pts</span>
                </span>
              ) : (
                <span className="text-muted-foreground italic">No data</span>
              )}
            </div>
          );
        })}
        {available.length < 3 && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Weights redistributed across {available.length} available pillar{available.length !== 1 ? 's' : ''}.
          </p>
        )}
      </div>
    );
  }

  if (scoreType === 'environmental' && inputs.pillarScores) {
    const ps = inputs.pillarScores;
    const subs = [
      { name: 'Climate', score: ps.climate, weight: 0.30 },
      { name: 'Water', score: ps.water, weight: 0.25 },
      { name: 'Circularity', score: ps.circularity, weight: 0.25 },
      { name: 'Nature', score: ps.nature, weight: 0.20 },
    ];
    return (
      <div className="space-y-1.5">
        {subs.map(s => (
          <div key={s.name} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{s.name} ({(s.weight * 100).toFixed(0)}%)</span>
            {s.score !== null ? (
              <span className="font-medium tabular-nums">{s.score}</span>
            ) : (
              <span className="text-muted-foreground italic">No data</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (scoreType === 'social' && inputs.socialScores) {
    const ss = inputs.socialScores;
    const subs = [
      { name: 'Community impact', score: ss.community },
      { name: 'People & culture', score: ss.people_culture },
      { name: 'Supplier ESG', score: ss.supplier_esg },
    ];
    return (
      <div className="space-y-1.5">
        {subs.map(s => (
          <div key={s.name} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{s.name}</span>
            {s.score !== null ? (
              <span className="font-medium tabular-nums">{s.score}</span>
            ) : (
              <span className="text-muted-foreground italic">No data</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (scoreType === 'governance' && inputs.governanceScores) {
    const gs = inputs.governanceScores;
    const subs = [
      { name: 'Governance practices (85%)', score: gs.governance },
      { name: 'Certifications progress (15%)', score: gs.certifications },
    ];
    return (
      <div className="space-y-1.5">
        {subs.map(s => (
          <div key={s.name} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{s.name}</span>
            {s.score !== null ? (
              <span className="font-medium tabular-nums">{s.score}</span>
            ) : (
              <span className="text-muted-foreground italic">No data</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  return null;
}

export function ScoreExplainer({
  scoreType,
  currentScore,
  benchmark,
  calculationInputs,
  className,
}: ScoreExplainerProps) {
  const router = useRouter();
  const config = scoreTypeConfig[scoreType];
  const hasData = currentScore !== null;
  const currentBand = hasData
    ? config.bands.find(band => currentScore >= band.min) || config.bands[config.bands.length - 1]
    : null;

  const improvementGuidance = getImprovementGuidance(scoreType, currentScore, calculationInputs);

  const handleAskRosa = () => {
    const prompt = buildRosaPrompt(scoreType, currentScore, calculationInputs);
    router.push(`/rosa?prompt=${encodeURIComponent(prompt)}`);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-6 w-6 p-0 hover:bg-muted", className)}
        >
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="sr-only">Score information</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 p-0 overflow-y-auto max-h-[min(80vh,var(--radix-popover-content-available-height))]"
        align="start"
        side="bottom"
        sideOffset={4}
        collisionPadding={16}
      >
        <div className="p-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-base">{config.title}</h3>
              {config.weight && (
                <Badge variant="outline" className="text-xs">
                  {config.weight} weight
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {config.description}
            </p>
          </div>

          <div className="border-t pt-3">
            <div className="flex items-start gap-2 mb-2">
              <Target className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Your Score</p>
                {hasData && currentBand ? (
                  <>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-bold">{currentScore}</span>
                      <Badge variant="outline" className={cn(
                        'text-xs',
                        currentBand.color === 'green' && 'border-green-500 text-green-700 dark:text-green-400',
                        currentBand.color === 'emerald' && 'border-emerald-500 text-emerald-700 dark:text-emerald-400',
                        currentBand.color === 'amber' && 'border-amber-500 text-amber-700 dark:text-amber-400',
                        currentBand.color === 'orange' && 'border-orange-500 text-orange-700 dark:text-orange-400',
                        currentBand.color === 'red' && 'border-red-500 text-red-700 dark:text-red-400',
                      )}>
                        {currentBand.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {currentBand.description}
                    </p>
                  </>
                ) : (
                  <div className="mt-1">
                    <span className="text-lg font-medium text-muted-foreground">Awaiting Data</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Add relevant data to calculate this score
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {calculationInputs && hasData && (
            <div className="border-t pt-3">
              <div className="flex items-start gap-2 mb-2">
                <Calculator className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium mb-2">Your Calculation</p>
                  <CalculationBreakdown scoreType={scoreType} inputs={calculationInputs} />
                </div>
              </div>
            </div>
          )}

          {improvementGuidance && hasData && (
            <div className="border-t pt-3">
              <div className="flex items-start gap-2">
                <ArrowUpRight className="h-4 w-4 mt-0.5 text-emerald-500" />
                <div>
                  <p className="text-sm font-medium">How to Improve</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {improvementGuidance}
                  </p>
                </div>
              </div>
            </div>
          )}

          {benchmark && (benchmark.platform_average || benchmark.category_average) && (
            <div className="border-t pt-3">
              <div className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium">Benchmarks</p>

                  {benchmark.platform_average && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">AlkaTera Average</span>
                      <span className="font-medium">{benchmark.platform_average}</span>
                    </div>
                  )}

                  {benchmark.category_average && benchmark.category_name && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{benchmark.category_name}</span>
                      <span className="font-medium">{benchmark.category_average}</span>
                    </div>
                  )}

                  {benchmark.top_performer && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Top Performer</span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {benchmark.top_performer}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="border-t pt-3">
            <div className="flex items-start gap-2 mb-3">
              <Award className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <p className="text-sm font-medium">Score Bands</p>
            </div>
            <div className="space-y-2">
              {config.bands.map((band) => (
                <div
                  key={band.label}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-md text-xs transition-colors',
                    hasData && currentScore !== null && currentScore >= band.min && currentScore < (config.bands.find(b => b.min > band.min)?.min || 101)
                      ? 'bg-primary/10 border border-primary/20'
                      : 'bg-muted/30'
                  )}
                >
                  <div className={cn(
                    'h-2 w-2 rounded-full flex-shrink-0',
                    band.color === 'green' && 'bg-green-500',
                    band.color === 'emerald' && 'bg-emerald-500',
                    band.color === 'amber' && 'bg-amber-500',
                    band.color === 'orange' && 'bg-orange-500',
                    band.color === 'red' && 'bg-red-500',
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{band.label}</span>
                      <span className="text-muted-foreground">
                        {band.min}{config.bands.find(b => b.min > band.min) ? `-${(config.bands.find(b => b.min > band.min)?.min || 101) - 1}` : '+'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Methodology:</span> {config.methodology}
            </p>
          </div>

          <div className="border-t pt-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-xs"
              onClick={handleAskRosa}
            >
              <Dog className="h-3.5 w-3.5" />
              Ask Rosa to explain this score
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
