import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ── Mocks ────────────────────────────────────────────────────────────────────
// Chainable supabase stub that records every from(table) call with its method
// chain, so tests can assert exactly which writes hit product_materials.

const h = vi.hoisted(() => {
  const ING_1 = '11111111-1111-1111-1111-111111111111'
  const ING_2 = '22222222-2222-2222-2222-222222222222'

  const ingredientRows = [
    {
      id: ING_1, material_name: 'Barley', material_type: 'ingredient',
      quantity: 10, unit: 'kg', created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: ING_2, material_name: 'Hops', material_type: 'ingredient',
      quantity: 2, unit: 'kg', created_at: '2026-01-02T00:00:00Z',
    },
  ]

  type Op = { method: string; args: any[] }
  const fromCalls: Array<{ table: string; ops: Op[] }> = []

  function respond(table: string, ops: Op[]) {
    if (table === 'products') {
      return {
        data: {
          id: '42', name: 'Test Ale', sku: null, product_description: null,
          product_image_url: null, functional_unit: null, unit_size_value: null,
          unit_size_unit: null, recipe_scale_mode: null, batch_yield_value: null,
          batch_yield_unit: null, latest_lca_id: null,
        },
        error: null,
      }
    }
    if (table === 'product_materials') {
      if (ops.some(o => ['delete', 'update'].includes(o.method))) return { data: null, error: null }
      if (ops.some(o => o.method === 'insert')) return { data: [], error: null }
      // Autosave re-fetch: select('id') filtered to ingredients
      if (ops.some(o => o.method === 'select' && o.args[0] === 'id')) {
        return { data: ingredientRows.map(r => ({ id: r.id })), error: null }
      }
      // Initial load: select('*')
      return { data: ingredientRows, error: null }
    }
    return { data: [], error: null, count: 0 }
  }

  function makeChain(table: string) {
    const ops: Op[] = []
    fromCalls.push({ table, ops })
    const chain: Record<string, any> = {}
    for (const m of ['select', 'eq', 'in', 'order', 'insert', 'update', 'delete', 'limit', 'maybeSingle', 'single']) {
      chain[m] = vi.fn((...args: any[]) => {
        ops.push({ method: m, args })
        return chain
      })
    }
    chain.then = (resolve: any, reject: any) =>
      Promise.resolve(respond(table, ops)).then(resolve, reject)
    return chain
  }

  return {
    ING_1, ING_2, fromCalls,
    supabase: { from: vi.fn((table: string) => makeChain(table)) },
  }
})

vi.mock('@/lib/supabaseClient', () => ({ supabase: h.supabase }))
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

import { useRecipeEditor } from '../useRecipeEditor'

// ── Helpers ──────────────────────────────────────────────────────────────────

const materialWrites = () =>
  h.fromCalls
    .filter(c => c.table === 'product_materials')
    .flatMap(c => c.ops.map(op => ({ ...op, ops: c.ops })))
    .filter(op => ['delete', 'update', 'insert'].includes(op.method))

async function loadHook() {
  const rendered = renderHook(() => useRecipeEditor('42', 'org-1'))
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  expect(rendered.result.current.loading).toBe(false)
  expect(rendered.result.current.ingredientForms).toHaveLength(2)
  h.fromCalls.length = 0 // only inspect writes made by autosave
  return rendered
}

const fireAutosave = () => act(async () => { await vi.advanceTimersByTimeAsync(9000) })

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useRecipeEditor ingredient autosave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    h.fromCalls.length = 0
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('does not delete a saved row whose amount is cleared mid-edit', async () => {
    const { result } = await loadHook()

    act(() => { result.current.updateIngredient(h.ING_1, { amount: '' }) })
    await fireAutosave()

    const writes = materialWrites()
    // The mid-edit row must survive: no delete at all (both ids still in form)
    expect(writes.filter(w => w.method === 'delete')).toHaveLength(0)
    // The valid row is updated in place, preserving its id (no re-insert churn)
    const updates = writes.filter(w => w.method === 'update')
    expect(updates).toHaveLength(1)
    expect(updates[0].ops).toContainEqual({ method: 'eq', args: ['id', h.ING_2] })
    expect(writes.filter(w => w.method === 'insert')).toHaveLength(0)
  })

  it('deletes only rows actually removed from the form', async () => {
    const { result } = await loadHook()

    act(() => { result.current.removeIngredient(h.ING_1) })
    await fireAutosave()

    const writes = materialWrites()
    const deletes = writes.filter(w => w.method === 'delete')
    expect(deletes).toHaveLength(1)
    // Targeted delete via .in([removed id]) — never a blanket product-wide delete
    expect(deletes[0].ops).toContainEqual({ method: 'in', args: ['id', [h.ING_1]] })
    const updates = writes.filter(w => w.method === 'update')
    expect(updates).toHaveLength(1)
    expect(updates[0].ops).toContainEqual({ method: 'eq', args: ['id', h.ING_2] })
  })
})
