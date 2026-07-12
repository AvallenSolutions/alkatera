// Status workflow for reduction initiatives (the action layer under
// sustainability targets). Pure module shared by the API routes (server-side
// enforcement) and the UI (button visibility, status chips) so the two can
// never disagree about what's allowed.
//
//   draft ──submit──> pending_approval ──approve──> active ──complete──> completed
//     ^                     │ reject                  │
//     └─────────────────────┘                         └──cancel──> cancelled
//
// Only active/completed initiatives count as B Corp evidence
// (lib/certifications/initiative-evidence.ts).

import type { WorkingTone } from '@/components/studio/theme';

export type InitiativeStatus =
  | 'draft'
  | 'pending_approval'
  | 'active'
  | 'completed'
  | 'cancelled';

export type InitiativeAction = 'submit' | 'approve' | 'reject' | 'complete' | 'cancel';

// Each status carries a studio working tone directly, so the UI reads its
// colour from here rather than remapping colour names at render time.
export const INITIATIVE_STATUSES: Record<
  InitiativeStatus,
  { label: string; description: string; tone: WorkingTone }
> = {
  draft: {
    label: 'Draft',
    description: 'Being worked on; not yet sent for approval.',
    tone: 'quiet',
  },
  pending_approval: {
    label: 'Waiting for approval',
    description: 'Sent for approval by an organisation owner or admin.',
    tone: 'attention',
  },
  active: {
    label: 'Active',
    description: 'Approved and under way. Counts towards B Corp evidence.',
    tone: 'good',
  },
  completed: {
    label: 'Completed',
    description: 'Finished. Still counts towards B Corp evidence.',
    tone: 'good',
  },
  cancelled: {
    label: 'Cancelled',
    description: 'Stopped before completion.',
    tone: 'stale',
  },
};

/** The status an action moves an initiative to. */
export const ACTION_RESULT: Record<InitiativeAction, InitiativeStatus> = {
  submit: 'pending_approval',
  approve: 'active',
  reject: 'draft',
  complete: 'completed',
  cancel: 'cancelled',
};

const ADMIN_ROLES = ['owner', 'admin'];

/**
 * Whether `role` (the viewer's org role name) may perform `action` on an
 * initiative currently in `fromStatus`. `isOwner` is true when the viewer is
 * the initiative's owner (owner_user_id) or its creator.
 *
 * Rules:
 * - submit: any member, only from draft
 * - approve / reject: owner/admin only, only from pending_approval
 * - complete: admin or the initiative's owner, only from active
 * - cancel: admin or the initiative's owner, from active or pending_approval
 */
export function canTransition(
  action: InitiativeAction,
  fromStatus: InitiativeStatus,
  role: string | null | undefined,
  isOwner: boolean,
): boolean {
  const isAdmin = ADMIN_ROLES.includes((role || '').toLowerCase());

  switch (action) {
    case 'submit':
      return fromStatus === 'draft';
    case 'approve':
    case 'reject':
      return fromStatus === 'pending_approval' && isAdmin;
    case 'complete':
      return fromStatus === 'active' && (isAdmin || isOwner);
    case 'cancel':
      return (fromStatus === 'active' || fromStatus === 'pending_approval') && (isAdmin || isOwner);
    default:
      return false;
  }
}
