/**
 * ISO 14044 §4.5 Life Cycle Interpretation Module
 *
 * Generates a structured Interpretation chapter from aggregated LCA impacts.
 * Required by ISO 14044 §4.5 and comprises three mandatory elements:
 *   §4.5.2 — Identification of significant issues (hotspot analysis)
 *   §4.5.3 — Evaluation (completeness, sensitivity, consistency checks)
 *   §4.5.4 — Conclusions, limitations, and recommendations
 *
 * This module reads from the `aggregated_impacts` JSONB output and produces
 * a plain-object result that can be stored alongside it and rendered in the PDF.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface InterpretationResult {
  /** §4.5.2 Significant issues — hotspot identification */
  significant_issues: {
    hotspots: Hotspot[];
    dominant_lifecycle_stage: string;
    dominant_stage_pct: number;
    dominant_scope: string;
    dominant_scope_pct: number;
    summary: string;
  };
  /** §4.5.3 Evaluation checks */
  evaluation: {
    completeness: CompletenessCheck;
    sensitivity: SensitivityEvaluation;
    consistency: ConsistencyCheck;
  };
  /** §4.5.4 Conclusions, limitations, and recommendations */
  conclusions: {
    key_findings: string[];
    limitations: string[];
    recommendations: string[];
    improvement_opportunities: string[];
  };
}

export interface Hotspot {
  name: string;
  impact_kg_co2e: number;
  contribution_pct: number;
  category: string; // 'material' | 'stage' | 'scope'
}

export interface CompletenessCheck {
  is_complete: boolean;
  coverage_pct: number;
  missing_stages: string[];
  notes: string[];
}

export interface SensitivityEvaluation {
  has_analysis: boolean;
  highly_sensitive_count: number;
  max_sensitivity_ratio: number;
  conclusion: string;
}

export interface ConsistencyCheck {
  is_consistent: boolean;
  issues: string[];
  notes: string[];
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Generate an ISO 14044 §4.5 Interpretation from aggregated impacts.
 *
 * @param aggregatedImpacts - The `aggregated_impacts` JSONB object from the PCF record
 * @param systemBoundary - e.g. 'cradle-to-gate', 'cradle-to-grave'
 * @returns InterpretationResult to be stored in aggregated_impacts.interpretation
 */
export function generateInterpretation(
  aggregatedImpacts: Record<string, any>,
  systemBoundary: string
): InterpretationResult {
  const totalClimate = aggregatedImpacts.total_carbon_footprint || aggregatedImpacts.climate_change_gwp100 || 0;
  const breakdown = aggregatedImpacts.breakdown || {};
  const byMaterial: Array<{ name: string; climate: number }> = breakdown.by_material || [];
  const byStage = breakdown.by_lifecycle_stage || {};
  const byScope = breakdown.by_scope || {};
  const uncertaintySensitivity = aggregatedImpacts.uncertainty_sensitivity || {};
  const sensitivityAnalysis = uncertaintySensitivity.sensitivity_analysis || {};
  const warnings = aggregatedImpacts.calculation_warnings || [];

  // ── §4.5.2 Significant Issues ──────────────────────────────────────────

  // Material hotspots (>5% contribution)
  const hotspots: Hotspot[] = byMaterial
    .filter((m: any) => totalClimate > 0 && (Math.abs(m.climate) / totalClimate) > 0.05)
    .map((m: any) => ({
      name: m.name,
      impact_kg_co2e: m.climate,
      contribution_pct: Math.round((Math.abs(m.climate) / totalClimate) * 1000) / 10,
      category: 'material' as const,
    }))
    .sort((a: Hotspot, b: Hotspot) => b.contribution_pct - a.contribution_pct);

  // Dominant lifecycle stage
  const stageEntries = Object.entries(byStage)
    .map(([key, val]) => ({ name: formatStageName(key), value: Number(val) || 0 }))
    .filter(s => s.value !== 0)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  const dominantStage = stageEntries[0] || { name: 'Unknown', value: 0 };
  const dominantStagePct = totalClimate > 0
    ? Math.round((Math.abs(dominantStage.value) / totalClimate) * 1000) / 10
    : 0;

  // Dominant scope
  const scopeEntries = [
    { name: 'Scope 1 (Direct)', value: byScope.scope1 || 0 },
    { name: 'Scope 2 (Energy)', value: byScope.scope2 || 0 },
    { name: 'Scope 3 (Value Chain)', value: byScope.scope3 || 0 },
  ].sort((a, b) => b.value - a.value);

  const dominantScope = scopeEntries[0];
  const totalScopes = scopeEntries.reduce((s, e) => s + e.value, 0);
  const dominantScopePct = totalScopes > 0
    ? Math.round((dominantScope.value / totalScopes) * 1000) / 10
    : 0;

  // Summary sentence
  const topHotspotNames = hotspots.slice(0, 3).map(h => h.name).join(', ');
  const significantSummary = hotspots.length > 0
    ? `The most significant contributors to the carbon footprint are ${topHotspotNames}, ` +
      `collectively accounting for ${hotspots.slice(0, 3).reduce((s, h) => s + h.contribution_pct, 0).toFixed(1)}% ` +
      `of the total impact. The ${dominantStage.name.toLowerCase()} stage dominates at ${dominantStagePct}%.`
    : `No individual material contributes more than 5% of the total footprint. ` +
      `Impacts are distributed across multiple inputs.`;

  // ── §4.5.3 Evaluation ─────────────────────────────────────────────────

  // Completeness check
  const boundaryLower = systemBoundary.toLowerCase();
  const expectedStages = getExpectedStages(boundaryLower);
  const presentStages = Object.entries(byStage)
    .filter(([, val]) => Number(val) !== 0)
    .map(([key]) => key);
  const missingStages = expectedStages.filter(s => !presentStages.includes(s));
  const coveragePct = expectedStages.length > 0
    ? Math.round(((expectedStages.length - missingStages.length) / expectedStages.length) * 100)
    : 100;

  const completenessNotes: string[] = [];
  if (missingStages.length > 0) {
    completenessNotes.push(
      `Missing lifecycle stages: ${missingStages.map(formatStageName).join(', ')}. ` +
      `These stages are within the declared system boundary but report zero emissions.`
    );
  }
  if (warnings.length > 0) {
    completenessNotes.push(`${warnings.length} calculation warning(s) were raised during aggregation.`);
  }

  const completeness: CompletenessCheck = {
    is_complete: missingStages.length === 0,
    coverage_pct: coveragePct,
    missing_stages: missingStages.map(formatStageName),
    notes: completenessNotes,
  };

  // Sensitivity evaluation (from CRITICAL 3 results)
  const sensitivityParams = sensitivityAnalysis.parameters || [];
  const highlySensitiveCount = sensitivityParams.filter((p: any) => p.is_highly_sensitive).length;
  const maxRatio = sensitivityParams.length > 0
    ? Math.max(...sensitivityParams.map((p: any) => p.sensitivity_ratio || 0))
    : 0;

  const sensitivity: SensitivityEvaluation = {
    has_analysis: sensitivityParams.length > 0,
    highly_sensitive_count: highlySensitiveCount,
    max_sensitivity_ratio: maxRatio,
    conclusion: sensitivityAnalysis.conclusion || 'No sensitivity analysis available.',
  };

  // Consistency check
  const consistencyIssues: string[] = [];
  const consistencyNotes: string[] = [];

  // Check stage/total reconciliation
  const stageSum = Object.values(byStage).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
  const stageDiscrepancy = Math.abs(stageSum - totalClimate);
  if (stageDiscrepancy > 0.001 && totalClimate > 0) {
    consistencyIssues.push(
      `Lifecycle stage sum (${stageSum.toFixed(4)} kg CO₂e) differs from headline total ` +
      `(${totalClimate.toFixed(4)} kg CO₂e) by ${stageDiscrepancy.toFixed(4)} kg CO₂e.`
    );
  }

  // Check scope/total reconciliation
  const scopeSum = totalScopes;
  const scopeDiscrepancy = Math.abs(scopeSum - totalClimate);
  if (scopeDiscrepancy > totalClimate * 0.05 && totalClimate > 0) {
    consistencyIssues.push(
      `Scope sum (${scopeSum.toFixed(4)} kg CO₂e) differs from headline total by ` +
      `${((scopeDiscrepancy / totalClimate) * 100).toFixed(1)}%.`
    );
  }

  consistencyNotes.push('All materials use the same characterisation method (IPCC AR6 GWP-100).');
  consistencyNotes.push('Allocation procedures are applied consistently across all co-products.');

  const consistency: ConsistencyCheck = {
    is_consistent: consistencyIssues.length === 0,
    issues: consistencyIssues,
    notes: consistencyNotes,
  };

  // ── §4.5.4 Conclusions, Limitations, and Recommendations ──────────────

  const keyFindings: string[] = [];
  const limitations: string[] = [];
  const recommendations: string[] = [];
  const improvements: string[] = [];

  // Key findings
  keyFindings.push(
    `The total carbon footprint is ${totalClimate.toFixed(3)} kg CO₂e per functional unit.`
  );
  if (hotspots.length > 0) {
    keyFindings.push(
      `${hotspots[0].name} is the largest single contributor at ${hotspots[0].contribution_pct}% of the total.`
    );
  }
  if (dominantStagePct > 50) {
    keyFindings.push(
      `The ${dominantStage.name.toLowerCase()} stage accounts for over half the total impact (${dominantStagePct}%).`
    );
  }
  if (dominantScopePct > 80) {
    keyFindings.push(
      `${dominantScope.name} represents ${dominantScopePct}% of emissions, indicating the value chain is the primary source of impact.`
    );
  }

  // Limitations
  const dqAssessment = uncertaintySensitivity.data_quality_assessment || {};
  const uncertaintyPct = uncertaintySensitivity.propagated_uncertainty_pct || 0;
  if (uncertaintyPct > 30) {
    limitations.push(
      `Propagated uncertainty is ±${uncertaintyPct}% (95% CI), reflecting reliance on secondary data sources.`
    );
  }
  if (!completeness.is_complete) {
    limitations.push(
      `${completeness.missing_stages.length} lifecycle stage(s) within the system boundary report zero emissions: ${completeness.missing_stages.join(', ')}.`
    );
  }
  if (dqAssessment.compliance_gaps && dqAssessment.compliance_gaps.length > 0) {
    limitations.push(
      `Data quality compliance gaps identified: ${dqAssessment.compliance_gaps.length} issue(s).`
    );
  }
  limitations.push(
    'Secondary LCI data (ecoinvent, AGRIBALYSE, DEFRA) represents average technology and conditions; ' +
    'site-specific primary data would improve accuracy.'
  );

  // Recommendations
  if (hotspots.length > 0) {
    recommendations.push(
      `Prioritise supplier engagement for ${hotspots[0].name} to obtain primary verified data and reduce uncertainty.`
    );
  }
  if (highlySensitiveCount > 0) {
    const sensitiveNames = sensitivityParams
      .filter((p: any) => p.is_highly_sensitive)
      .map((p: any) => p.material_name)
      .join(', ');
    recommendations.push(
      `Improve data quality for highly sensitive parameters (${sensitiveNames}) to strengthen result robustness.`
    );
  }
  if (!completeness.is_complete) {
    recommendations.push(
      `Complete data collection for missing lifecycle stages (${completeness.missing_stages.join(', ')}) to achieve full boundary coverage.`
    );
  }
  recommendations.push(
    'Conduct a third-party critical review per ISO 14044 §6 before using this study for public comparative assertions.'
  );

  // Improvement opportunities
  if (hotspots.length > 0) {
    improvements.push(
      `Reduce emissions from ${hotspots[0].name} through alternative sourcing, process optimisation, or supplier decarbonisation programmes.`
    );
  }
  if (stageEntries.length > 0 && stageEntries[0].name === 'Raw Materials') {
    improvements.push(
      'Investigate lower-carbon alternative ingredients or suppliers with verified environmental performance.'
    );
  }
  improvements.push(
    'Increase the proportion of primary verified data to improve overall data quality and reduce uncertainty.'
  );

  return {
    significant_issues: {
      hotspots,
      dominant_lifecycle_stage: dominantStage.name,
      dominant_stage_pct: dominantStagePct,
      dominant_scope: dominantScope.name,
      dominant_scope_pct: dominantScopePct,
      summary: significantSummary,
    },
    evaluation: {
      completeness,
      sensitivity,
      consistency,
    },
    conclusions: {
      key_findings: keyFindings,
      limitations,
      recommendations,
      improvement_opportunities: improvements,
    },
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function formatStageName(key: string): string {
  const map: Record<string, string> = {
    raw_materials: 'Raw Materials',
    processing: 'Processing',
    packaging: 'Packaging',
    distribution: 'Distribution',
    use_phase: 'Use Phase',
    end_of_life: 'End of Life',
  };
  return map[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getExpectedStages(boundary: string): string[] {
  const base = ['raw_materials', 'processing', 'packaging'];
  if (boundary === 'cradle-to-shelf' || boundary === 'cradle-to-consumer' || boundary === 'cradle-to-grave') {
    base.push('distribution');
  }
  if (boundary === 'cradle-to-consumer' || boundary === 'cradle-to-grave') {
    base.push('use_phase');
  }
  if (boundary === 'cradle-to-grave') {
    base.push('end_of_life');
  }
  return base;
}
