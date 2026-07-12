/**
 * Shared status -> working-tone ladders for the EPR family (THE WIRING).
 *
 * These map EPR data states to the studio's typographic working tones so the
 * same ladder is never hand-rolled twice. Call sites render the result with
 * StateChip: <StateChip tone={x.tone}>{x.label}</StateChip>.
 *
 * Follows the certifications precedent (lib/certifications/status-tones.ts).
 */
import type { WorkingTone } from '@/components/studio/theme'

export interface StatusTone {
  label: string
  tone: WorkingTone
}

/**
 * Producer obligation size. Accepts both the API's 'below_threshold' and the
 * settings page's shorthand 'below'.
 */
export function obligationStatusTone(size: string | null | undefined): StatusTone {
  switch (size) {
    case 'large':
      return { label: 'Large Producer', tone: 'stale' }
    case 'small':
      return { label: 'Small Producer', tone: 'attention' }
    case 'below':
    case 'below_threshold':
      return { label: 'Below Threshold', tone: 'good' }
    case 'pending':
      return { label: 'Pending Setup', tone: 'quiet' }
    default:
      return { label: 'Pending Setup', tone: 'quiet' }
  }
}

/** RPD submission lifecycle: draft -> ready -> submitted / amended. */
export function submissionStatusTone(status: string): StatusTone {
  switch (status) {
    case 'draft':
      return { label: 'Draft', tone: 'quiet' }
    case 'ready':
      return { label: 'Ready', tone: 'hold' }
    case 'submitted':
      return { label: 'Submitted', tone: 'good' }
    case 'amended':
      return { label: 'Amended', tone: 'attention' }
    default:
      return { label: status, tone: 'quiet' }
  }
}

/** PRN obligation fulfilment: not started -> partial -> fulfilled / exceeded. */
export function prnStatusTone(status: string): StatusTone {
  switch (status) {
    case 'not_started':
      return { label: 'Not Started', tone: 'stale' }
    case 'partial':
      return { label: 'Partial', tone: 'attention' }
    case 'fulfilled':
      return { label: 'Fulfilled', tone: 'good' }
    case 'exceeded':
      return { label: 'Exceeded', tone: 'good' }
    default:
      return { label: status, tone: 'quiet' }
  }
}

/** Audit-trail action types. */
export function auditActionTone(action: string): StatusTone {
  switch (action) {
    case 'create':
      return { label: 'Create', tone: 'good' }
    case 'update':
      return { label: 'Update', tone: 'quiet' }
    case 'delete':
      return { label: 'Delete', tone: 'stale' }
    case 'generate_csv':
      return { label: 'Generate CSV', tone: 'hold' }
    case 'submit':
      return { label: 'Submit', tone: 'good' }
    case 'approve':
      return { label: 'Approve', tone: 'good' }
    case 'amend':
      return { label: 'Amend', tone: 'attention' }
    case 'estimate_nations':
      return { label: 'Estimate Nations', tone: 'hold' }
    default:
      return { label: action, tone: 'quiet' }
  }
}

/** RAM (red-amber-green) recyclability rating -> working tone. */
export function ramRatingTone(rating: string | null | undefined): WorkingTone {
  switch (rating) {
    case 'green':
      return 'good'
    case 'amber':
      return 'attention'
    case 'red':
      return 'stale'
    default:
      return 'quiet'
  }
}
