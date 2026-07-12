/**
 * Shared status -> working-tone ladders for the certifications family.
 *
 * These map data states to the studio's typographic working tones so the same
 * ladder is never hand-rolled twice. Used by StateChip / BigNumber tone props
 * across the B Corp experience and the legacy framework monolith.
 */
import type { WorkingTone } from '@/components/studio/theme';

/** Audit-package lifecycle: draft -> submitted -> in_review -> approved/rejected. */
export function auditPackageStatusTone(status: string | null | undefined): WorkingTone {
  switch (status) {
    case 'approved':
      return 'good';
    case 'submitted':
      return 'hold';
    case 'in_review':
      return 'attention';
    case 'rejected':
      return 'stale';
    default:
      return 'quiet';
  }
}

/** Evidence verification: verified -> good, rejected -> stale, otherwise pending. */
export function evidenceVerificationTone(status: string | null | undefined): WorkingTone {
  switch (status) {
    case 'verified':
      return 'good';
    case 'rejected':
      return 'stale';
    default:
      return 'attention';
  }
}

/** Requirement resolution: compliant -> good, partial -> attention, otherwise stale. */
export function requirementResolutionTone(status: string | null | undefined): WorkingTone {
  switch (status) {
    case 'compliant':
      return 'good';
    case 'partial':
      return 'attention';
    case 'non_compliant':
      return 'stale';
    default:
      return 'quiet';
  }
}
