import { describe, expect, it, vi } from 'vitest';
import { proposeAction, cancelAction, executeAction, loadPendingAction, type PendingAction } from '../actions';

function mockSupabase(initialRow: Partial<PendingAction> | null = null) {
  let row: any = initialRow ? { ...initialRow } : null;
  const inserts: any[] = [];
  const updates: any[] = [];

  const client = {
    from: (table: string) => {
      const state: any = {
        _table: table,
        _pendingUpdate: null,
        insert(payload: any) {
          if (table === 'rosa_pending_actions') {
            row = { ...payload, id: 'pa-1', status: payload.status ?? 'pending' };
            inserts.push(payload);
          } else {
            inserts.push({ __table: table, ...payload });
          }
          return this;
        },
        update(patch: any) {
          this._pendingUpdate = patch;
          return this;
        },
        select: () => state,
        eq: () => state,
        async single() {
          if (state._pendingUpdate) {
            row = { ...row, ...state._pendingUpdate };
            updates.push(state._pendingUpdate);
            state._pendingUpdate = null;
            return { data: row, error: null };
          }
          if (state.__insert) {
            const inserted = inserts[inserts.length - 1];
            return { data: { id: inserted.__table ? inserted.id : 'pa-1' }, error: null };
          }
          // for inserts into suppliers/targets/utility returning id
          const ins = inserts[inserts.length - 1];
          if (ins && ins.__table) {
            return { data: { id: `${ins.__table}-new` }, error: null };
          }
          if (table === 'rosa_pending_actions') return { data: { id: 'pa-1' }, error: null };
          return { data: null, error: null };
        },
        async maybeSingle() {
          return { data: row, error: null };
        },
      };
      // Terminal for update().eq().eq()... pattern
      state.then = undefined;
      Object.defineProperty(state, 'then', {
        value: (onFulfilled: any) => {
          if (state._pendingUpdate) {
            row = { ...row, ...state._pendingUpdate };
            updates.push(state._pendingUpdate);
            state._pendingUpdate = null;
            return Promise.resolve({ error: null }).then(onFulfilled);
          }
          return Promise.resolve({ data: [], error: null }).then(onFulfilled);
        },
      });
      return state;
    },
  };
  return { client: client as any, getRow: () => row, inserts, updates };
}

describe('proposeAction', () => {
  it('inserts a pending row and returns its id', async () => {
    const { client, getRow } = mockSupabase();
    const res = await proposeAction(client, {
      organizationId: 'org-1',
      userId: 'user-1',
      toolName: 'propose_add_supplier',
      payload: { name: 'Acme' },
      preview: 'Add supplier Acme',
    });
    expect(res.ok).toBe(true);
    expect(getRow().status).toBe('pending');
    expect(getRow().tool_name).toBe('propose_add_supplier');
  });
});

describe('cancelAction', () => {
  it('marks a pending row as cancelled', async () => {
    const { client, getRow } = mockSupabase({
      id: 'pa-1',
      user_id: 'user-1',
      organization_id: 'org-1',
      tool_name: 'propose_add_supplier',
      payload: { name: 'Acme' },
      preview: 'Add supplier Acme',
      status: 'pending',
      created_at: '2026-04-23',
      updated_at: '2026-04-23',
      result: null,
    });
    const res = await cancelAction(client, 'pa-1', 'user-1');
    expect(res.ok).toBe(true);
    expect(getRow().status).toBe('cancelled');
  });

  it('refuses to cancel an already-executed row', async () => {
    const { client } = mockSupabase({
      id: 'pa-1',
      user_id: 'user-1',
      organization_id: 'org-1',
      tool_name: 'propose_add_supplier',
      payload: {},
      preview: '',
      status: 'executed',
      created_at: '',
      updated_at: '',
      result: null,
    });
    const res = await cancelAction(client, 'pa-1', 'user-1');
    expect(res.ok).toBe(false);
  });
});

describe('executeAction', () => {
  it('dispatches to supplier insert and records result', async () => {
    const { client, getRow, inserts } = mockSupabase({
      id: 'pa-1',
      user_id: 'user-1',
      organization_id: 'org-1',
      tool_name: 'propose_add_supplier',
      payload: { name: 'Acme', country: 'UK' },
      preview: 'Add supplier Acme',
      status: 'pending',
      created_at: '',
      updated_at: '',
      result: null,
    });
    // The mock returns id based on last __table insert; we mark suppliers insert for id
    const origFrom = client.from;
    client.from = ((table: string) => {
      const base = origFrom(table);
      const baseInsert = base.insert.bind(base);
      base.insert = (payload: any) => {
        baseInsert({ ...payload, __table: table });
        return base;
      };
      return base;
    }) as any;

    const res = await executeAction(client, 'pa-1', 'user-1');
    expect(res.ok).toBe(true);
    expect(getRow().status).toBe('executed');
    const supplierInsert = inserts.find((i: any) => i.__table === 'suppliers');
    expect(supplierInsert?.name).toBe('Acme');
  });

  it('returns not-found for unknown action', async () => {
    const { client } = mockSupabase(null);
    const res = await executeAction(client, 'pa-missing', 'user-1');
    expect(res.ok).toBe(false);
  });
});

describe('action proposer tools', () => {
  it('expose the three action tool names', async () => {
    const { ACTION_TOOL_NAMES } = await import('../tools');
    expect(ACTION_TOOL_NAMES).toEqual(['propose_log_utility_entry', 'propose_set_target', 'propose_add_supplier']);
  });
});
