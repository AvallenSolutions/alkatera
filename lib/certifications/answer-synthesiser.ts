// Synthesise a single, paste-ready B Corp answer for one requirement from the
// data we already hold: real values from the platform probes, the user's own
// uploaded evidence, and the requirement guidance. Pure (no server / Supabase
// imports) so it is unit-testable and shared by BOTH the answer-key export
// (P0) and Rosa's per-requirement drafting (P2).

import type { PlatformEvidenceResult } from './platform-data';
import type { RequirementGuidance } from './requirement-guidance';
import type { RequirementStatusValue } from './scoring';

/** One evidence link, reduced to what the synthesiser needs. */
export interface SynthEvidenceLink {
  description: string | null;
  status: string | null;
  sourceModule: string | null;
}

export interface RequirementAnswerInput {
  status: RequirementStatusValue;
  /** Platform probe result for this requirement, or null when unmapped. */
  platform: PlatformEvidenceResult | null;
  evidenceLinks: SynthEvidenceLink[];
  guidance: RequirementGuidance;
}

/** How well the answer is backed by real data. */
export type AnswerConfidence = 'strong' | 'partial' | 'manual' | 'none';

export interface RequirementAnswer {
  /** Paste-ready value block for B Lab's questionnaire (may be empty). */
  answer: string;
  /** The individual data points behind the answer, for reference / Rosa. */
  dataPoints: string[];
  confidence: AnswerConfidence;
  /** What is still missing or how to strengthen it, or null when solid. */
  gap: string | null;
  /** Where the answer came from, e.g. "Emissions", "Manual evidence" or "". */
  dataSource: string;
  /** complete / partial / missing / manual / — as a display label. */
  dataQuality: string;
}

const COMPLETENESS_LABEL: Record<string, string> = {
  complete: 'Complete',
  partial: 'Partial',
  missing: 'Missing',
};

/** Turn a probe item into a single "Label: value" line, avoiding duplication. */
function formatDataPoint(label: string, summary: string): string {
  const s = summary.trim();
  if (!s) return '';
  return label && label.trim() && label.trim() !== s ? `${label.trim()}: ${s}` : s;
}

export function synthesiseRequirementAnswer(
  input: RequirementAnswerInput,
): RequirementAnswer {
  const { platform, evidenceLinks, guidance, status } = input;

  // 1. Real values from the platform are the strongest answer.
  const platformPoints: string[] = [];
  if (platform?.found) {
    for (const item of platform.items) {
      const point = formatDataPoint(item.label ?? '', item.summary ?? '');
      if (point) platformPoints.push(point);
    }
  }

  // 2. The user's own uploaded evidence descriptions.
  const manualPoints = evidenceLinks
    .map((e) => e.description?.trim())
    .filter((d): d is string => !!d);

  // Prefer platform values; fall back to what the user provided manually.
  const dataPoints =
    platformPoints.length > 0 ? platformPoints : manualPoints;

  let confidence: AnswerConfidence;
  if (platform?.found && platform.completeness === 'complete') {
    confidence = 'strong';
  } else if (platform?.found) {
    confidence = 'partial';
  } else if (dataPoints.length > 0) {
    confidence = 'manual';
  } else {
    confidence = 'none';
  }

  const dataSource = platform?.found
    ? platform.moduleLabel
    : evidenceLinks.length > 0
      ? 'Manual evidence'
      : '';

  const dataQuality = platform
    ? COMPLETENESS_LABEL[platform.completeness] ?? platform.completeness
    : evidenceLinks.length > 0
      ? 'Manual'
      : '';

  // What is still needed, phrased as an action.
  let gap: string | null = null;
  if (confidence === 'none') {
    const hints = guidance.evidence?.filter(Boolean) ?? [];
    gap = hints.length
      ? `Not in alkatera yet. Evidence B Lab will accept: ${hints.join('; ')}`
      : 'Not in alkatera yet. Upload a document or link data that shows how you meet this.';
  } else if (confidence === 'partial' && platform?.completenessNote) {
    gap = platform.completenessNote;
  } else if (status === 'in_progress' && dataPoints.length > 0) {
    gap =
      'Evidence is attached but not yet verified. Verify the link to finalise this answer.';
  }

  const answer = dataPoints.join('\n');

  return { answer, dataPoints, confidence, gap, dataSource, dataQuality };
}
