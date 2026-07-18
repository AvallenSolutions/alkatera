import type { SectionNarrative } from '@/lib/claude/section-narrative-assistant';
import type { KeyFinding } from '@/lib/claude/key-findings-assistant';

/**
 * The draft-then-edit narrative store, persisted in
 * generated_reports.data_snapshot (jsonb).
 *
 * Every narrative block carries a mutable aiGenerated flag: true while the
 * text is an unreviewed AI draft, flipped to false SERVER-SIDE the moment a
 * human edits it (applyNarrativeEdits never trusts a client-sent flag). The
 * flags survive into the audit trail and drive the "AI-assisted draft"
 * marking in the rendered document.
 *
 * Pure module: types + merge logic only, no I/O. This is the unit-test
 * surface for Phase C.
 */

/** Stored block: aiGenerated becomes mutable (the assistant types declare it readonly true). */
export type StoredSectionNarrative = Omit<SectionNarrative, 'aiGenerated'> & {
  aiGenerated: boolean;
};

export interface StoredExecutiveSummary {
  summaryText: string;
  primaryMessage: string;
  aiGenerated: boolean;
}

export interface StoredForeword {
  /** Draft text. */
  message: string;
  /** False once edited by a human. */
  aiGenerated: boolean;
  /**
   * True only after an explicit accept. Accepting copies the message into
   * config.branding.leadership.message, which is the only path to print.
   */
  accepted: boolean;
}

export type StoredKeyFinding = KeyFinding & { aiGenerated: boolean };

export interface NarrativeMeta {
  generated_at: string;
  model: string;
  /** The resolved tone instruction actually sent to the assistants. */
  tone: string;
  /** The review-step selector value; null = the style's own voice. */
  tone_override: string | null;
  review_state: 'draft' | 'shipped';
  /** Block ids that received deterministic fallbacks (AI unavailable). */
  fallback_blocks: string[];
  /** Cheap drift detection between draft time and review/ship time. */
  inputs_digest: {
    emissions_total: number;
    product_count: number;
    trend_years: number[];
  };
}

export interface ReportDataSnapshot {
  narratives: {
    executiveSummary: StoredExecutiveSummary;
    sections: Record<string, StoredSectionNarrative>;
    /** Present only for tier-'full' (storytelling) styles. */
    foreword?: StoredForeword;
  };
  keyFindings?: StoredKeyFinding[];
  narrative_meta: NarrativeMeta;
  /** Full assembled reportData at draft time (the CSRD audit snapshot). */
  inputs?: Record<string, unknown>;
}

/** Type guard both build paths use before consuming the store. */
export function hasNarrativeSnapshot(
  report: Record<string, any>
): report is Record<string, any> & { data_snapshot: ReportDataSnapshot } {
  const snap = report?.data_snapshot;
  return !!(
    snap &&
    typeof snap === 'object' &&
    snap.narratives &&
    typeof snap.narratives === 'object' &&
    snap.narratives.executiveSummary &&
    snap.narratives.sections
  );
}

export function computeInputsDigest(reportData: Record<string, any>): NarrativeMeta['inputs_digest'] {
  return {
    emissions_total: reportData?.emissions?.total ?? 0,
    product_count: Array.isArray(reportData?.products) ? reportData.products.length : 0,
    trend_years: Array.isArray(reportData?.emissionsTrends)
      ? reportData.emissionsTrends.map((t: any) => t.year)
      : [],
  };
}

// ============================================================================
// EDITS
// ============================================================================

/**
 * Human-editable fields per block type. Everything else (confidence
 * statements, methodology footnotes, finding scopes and magnitudes) is
 * machine-owned and silently ignored in patches.
 */
const SECTION_EDITABLE = ['headlineInsight', 'contextParagraph', 'nextStepPrompt'] as const;
const EXEC_EDITABLE = ['primaryMessage', 'summaryText'] as const;
const FINDING_EDITABLE = ['title', 'narrative'] as const;

export interface NarrativeEditPatch {
  sections?: Record<string, Partial<Pick<StoredSectionNarrative, (typeof SECTION_EDITABLE)[number]>>>;
  executiveSummary?: Partial<Pick<StoredExecutiveSummary, (typeof EXEC_EDITABLE)[number]>>;
  foreword?: { message?: string };
  acceptForeword?: boolean;
  keyFindings?: Array<{ index: number; title?: string; narrative?: string }>;
}

export class NarrativeEditError extends Error {}

/**
 * Apply human edits to a snapshot, returning a new snapshot plus the
 * accepted foreword message (when acceptForeword fired) for the caller to
 * copy into config.branding.leadership.
 *
 * Any block whose text actually changes gets aiGenerated: false. Unknown
 * section ids and edits against a missing snapshot throw NarrativeEditError.
 */
export function applyNarrativeEdits(
  snapshot: ReportDataSnapshot | null | undefined,
  patch: NarrativeEditPatch
): { snapshot: ReportDataSnapshot; acceptedForewordMessage: string | null } {
  if (!snapshot?.narratives) {
    throw new NarrativeEditError('No narrative snapshot to edit');
  }

  const next: ReportDataSnapshot = structuredClone(snapshot);

  // Sections
  for (const [sectionId, edits] of Object.entries(patch.sections ?? {})) {
    const block = next.narratives.sections[sectionId];
    if (!block) throw new NarrativeEditError(`Unknown section: ${sectionId}`);
    let changed = false;
    for (const field of SECTION_EDITABLE) {
      const value = edits[field];
      if (typeof value === 'string' && value !== block[field]) {
        block[field] = value;
        changed = true;
      }
    }
    if (changed) block.aiGenerated = false;
  }

  // Executive summary
  if (patch.executiveSummary) {
    const block = next.narratives.executiveSummary;
    let changed = false;
    for (const field of EXEC_EDITABLE) {
      const value = patch.executiveSummary[field];
      if (typeof value === 'string' && value !== block[field]) {
        block[field] = value;
        changed = true;
      }
    }
    if (changed) block.aiGenerated = false;
  }

  // Foreword
  if (patch.foreword?.message !== undefined || patch.acceptForeword) {
    if (!next.narratives.foreword) {
      throw new NarrativeEditError('This report has no foreword draft');
    }
  }
  if (typeof patch.foreword?.message === 'string' && next.narratives.foreword) {
    if (patch.foreword.message !== next.narratives.foreword.message) {
      next.narratives.foreword.message = patch.foreword.message;
      next.narratives.foreword.aiGenerated = false;
    }
  }
  let acceptedForewordMessage: string | null = null;
  if (patch.acceptForeword && next.narratives.foreword) {
    next.narratives.foreword.accepted = true;
    acceptedForewordMessage = next.narratives.foreword.message;
  }

  // Key findings
  for (const edit of patch.keyFindings ?? []) {
    const finding = next.keyFindings?.[edit.index];
    if (!finding) throw new NarrativeEditError(`Unknown key finding index: ${edit.index}`);
    let changed = false;
    for (const field of FINDING_EDITABLE) {
      const value = edit[field];
      if (typeof value === 'string' && value !== finding[field]) {
        finding[field] = value;
        changed = true;
      }
    }
    if (changed) finding.aiGenerated = false;
  }

  return { snapshot: next, acceptedForewordMessage };
}
