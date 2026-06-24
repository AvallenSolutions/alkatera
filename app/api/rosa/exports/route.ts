import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'

export const runtime = 'nodejs'

/**
 * GET /api/rosa/exports?kind=...&format=csv
 *
 * Read-only export endpoint Rosa uses via the `generate_export` tool to
 * deliver CSVs the user can download from inside the drawer chat. No
 * writes; no side effects. Org-scoped by membership; the same data the
 * user could already see in the UI.
 *
 * Supported kinds:
 *   - products_without_lca   — products without a completed LCA
 *   - unmatched_ingredients  — recipe ingredients lacking an emission
 *                              factor match
 *   - recent_approvals       — agent_exceptions approved in last 30 days
 *
 * Future kinds slot in by adding a builder below. CSVs are streamed back
 * as text/csv with a Content-Disposition: attachment header so the
 * download chip in the conversation triggers a save dialog directly.
 */
export async function GET(request: NextRequest) {
  const userSupabase = getSupabaseServerClient()
  const {
    data: { user },
    error: userErr,
  } = await userSupabase.auth.getUser()
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const url = new URL(request.url)
  const kind = url.searchParams.get('kind')
  const format = url.searchParams.get('format') ?? 'csv'
  if (format !== 'csv') {
    return NextResponse.json({ error: 'Only csv format is supported' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Service role missing' }, { status: 500 })
  }
  const service = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Member OR active advisor for the caller's selected org (advisor reads honoured).
  const organizationId = await resolveAccessibleOrg(service, user)
  if (!organizationId) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 })
  }

  let csv: string
  let filename: string

  switch (kind) {
    case 'products_without_lca':
      ({ csv, filename } = await buildProductsWithoutLcaCsv(service, organizationId))
      break
    case 'unmatched_ingredients':
      ({ csv, filename } = await buildUnmatchedIngredientsCsv(service, organizationId))
      break
    case 'recent_approvals':
      ({ csv, filename } = await buildRecentApprovalsCsv(service, organizationId))
      break
    default:
      return NextResponse.json({ error: `Unknown export kind: ${kind}` }, { status: 400 })
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

async function buildProductsWithoutLcaCsv(service: any, orgId: string) {
  const { data: products } = await service
    .from('products')
    .select('id, name, product_category, functional_unit, product_carbon_footprints!left(id)')
    .eq('organization_id', orgId)

  const without = (products || []).filter(
    (p: any) => !p.product_carbon_footprints || p.product_carbon_footprints.length === 0,
  )
  const rows = [
    ['name', 'product_category', 'functional_unit', 'product_id'],
    ...without.map((p: any) => [
      p.name ?? '',
      p.product_category ?? '',
      p.functional_unit ?? '',
      p.id,
    ]),
  ]
  return {
    csv: toCsv(rows),
    filename: `products-without-lca-${todayLocal()}.csv`,
  }
}

async function buildUnmatchedIngredientsCsv(service: any, orgId: string) {
  // recipe_ingredients with no emission-factor match. Match presence is
  // signalled by matched_source_name + ef_source on the row.
  const { data: ingredients } = await service
    .from('recipe_ingredients')
    .select('id, name, amount, unit, origin_country, matched_source_name, ef_source, product_id')
    .eq('organization_id', orgId)
    .or('matched_source_name.is.null,ef_source.is.null')

  const rows = [
    ['ingredient_name', 'amount', 'unit', 'origin_country', 'product_id', 'ingredient_id'],
    ...(ingredients || []).map((i: any) => [
      i.name ?? '',
      String(i.amount ?? ''),
      i.unit ?? '',
      i.origin_country ?? '',
      i.product_id ?? '',
      i.id,
    ]),
  ]
  return {
    csv: toCsv(rows),
    filename: `unmatched-ingredients-${todayLocal()}.csv`,
  }
}

async function buildRecentApprovalsCsv(service: any, orgId: string) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: approvals } = await service
    .from('agent_exceptions')
    .select('id, kind, title, summary, source, status, reviewed_at, applied_to')
    .eq('organization_id', orgId)
    .eq('status', 'approved')
    .gte('reviewed_at', since)
    .order('reviewed_at', { ascending: false })

  const rows = [
    ['reviewed_at', 'kind', 'title', 'source', 'applied_to_table', 'exception_id'],
    ...(approvals || []).map((a: any) => [
      a.reviewed_at ?? '',
      a.kind ?? '',
      a.title ?? '',
      a.source ?? '',
      a.applied_to?.table ?? '',
      a.id,
    ]),
  ]
  return {
    csv: toCsv(rows),
    filename: `recent-approvals-${todayLocal()}.csv`,
  }
}

function toCsv(rows: Array<Array<string | number>>): string {
  return rows
    .map(row => row.map(cell => csvEscape(String(cell ?? ''))).join(','))
    .join('\r\n')
}

function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function todayLocal(): string {
  return new Date().toISOString().slice(0, 10)
}
