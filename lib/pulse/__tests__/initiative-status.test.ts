import { describe, it, expect } from 'vitest';
import {
  canTransition,
  ACTION_RESULT,
  INITIATIVE_STATUSES,
  type InitiativeAction,
  type InitiativeStatus,
} from '../initiative-status';

const ALL_STATUSES = Object.keys(INITIATIVE_STATUSES) as InitiativeStatus[];
const ALL_ACTIONS = Object.keys(ACTION_RESULT) as InitiativeAction[];

describe('canTransition', () => {
  describe('submit', () => {
    it('any member can submit a draft', () => {
      expect(canTransition('submit', 'draft', 'member', false)).toBe(true);
      expect(canTransition('submit', 'draft', 'viewer', false)).toBe(true);
      expect(canTransition('submit', 'draft', 'admin', false)).toBe(true);
    });

    it('cannot submit from any other status', () => {
      for (const s of ALL_STATUSES.filter((x) => x !== 'draft')) {
        expect(canTransition('submit', s, 'admin', true)).toBe(false);
      }
    });
  });

  describe('approve / reject', () => {
    it('owner and admin can approve or reject a pending initiative', () => {
      expect(canTransition('approve', 'pending_approval', 'owner', false)).toBe(true);
      expect(canTransition('approve', 'pending_approval', 'admin', false)).toBe(true);
      expect(canTransition('reject', 'pending_approval', 'owner', false)).toBe(true);
      expect(canTransition('reject', 'pending_approval', 'Admin', false)).toBe(true); // case-insensitive
    });

    it('plain members cannot approve, even the initiative owner', () => {
      expect(canTransition('approve', 'pending_approval', 'member', true)).toBe(false);
      expect(canTransition('approve', 'pending_approval', null, true)).toBe(false);
      expect(canTransition('reject', 'pending_approval', 'member', true)).toBe(false);
    });

    it('cannot approve from non-pending statuses', () => {
      for (const s of ALL_STATUSES.filter((x) => x !== 'pending_approval')) {
        expect(canTransition('approve', s, 'owner', true)).toBe(false);
      }
    });
  });

  describe('complete', () => {
    it('admin or the initiative owner can complete an active initiative', () => {
      expect(canTransition('complete', 'active', 'admin', false)).toBe(true);
      expect(canTransition('complete', 'active', 'member', true)).toBe(true);
    });

    it('a plain member who is not the owner cannot complete', () => {
      expect(canTransition('complete', 'active', 'member', false)).toBe(false);
    });

    it('cannot complete from non-active statuses', () => {
      for (const s of ALL_STATUSES.filter((x) => x !== 'active')) {
        expect(canTransition('complete', s, 'admin', true)).toBe(false);
      }
    });
  });

  describe('cancel', () => {
    it('admin or owner can cancel an active or pending initiative', () => {
      expect(canTransition('cancel', 'active', 'admin', false)).toBe(true);
      expect(canTransition('cancel', 'pending_approval', 'member', true)).toBe(true);
    });

    it('a plain non-owner member cannot cancel', () => {
      expect(canTransition('cancel', 'active', 'member', false)).toBe(false);
    });

    it('completed and cancelled are terminal', () => {
      for (const action of ALL_ACTIONS) {
        expect(canTransition(action, 'completed', 'owner', true)).toBe(false);
        expect(canTransition(action, 'cancelled', 'owner', true)).toBe(false);
      }
    });
  });

  it('ACTION_RESULT maps every action to a valid status', () => {
    for (const action of ALL_ACTIONS) {
      expect(ALL_STATUSES).toContain(ACTION_RESULT[action]);
    }
  });

  it('status labels are plain language without jargon', () => {
    for (const s of ALL_STATUSES) {
      const meta = INITIATIVE_STATUSES[s];
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.label).not.toMatch(/pending_approval|_/);
    }
  });
});
