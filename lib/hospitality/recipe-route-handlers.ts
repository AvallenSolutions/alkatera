/**
 * Route-handler factories for hospitality recipes (meals / made-drinks).
 *
 * Both /api/hospitality/meals and /api/hospitality/drinks are thin wrappers
 * around these, differing only in the kind config — keeping one verified code
 * path for create/list/read/update/delete.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access'
import {
  listRecipes,
  createRecipe,
  getRecipe,
  updateRecipe,
  deleteRecipe,
  duplicateRecipe,
  type ServiceResult,
} from './recipe-service'
import type { RecipeKindConfig } from './recipe-kinds'

type AuthCtx =
  | { error: NextResponse }
  | { db: any; organizationId: string; userId: string }

async function auth(): Promise<AuthCtx> {
  const { client, user, error } = await getSupabaseAPIClient()
  if (error || !user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const organizationId = await resolveAccessibleOrg(client as any, user)
  if (!organizationId) {
    return { error: NextResponse.json({ error: 'No organisation' }, { status: 403 }) }
  }
  return { db: client as any, organizationId, userId: user.id }
}

function send<T>(r: ServiceResult<T>, key: string, successStatus = 200): NextResponse {
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ [key]: r.data }, {
    status: successStatus,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export function recipeCollectionHandlers(cfg: RecipeKindConfig) {
  return {
    async GET(request: NextRequest) {
      const a = await auth()
      if ('error' in a) return a.error
      const venue = new URL(request.url).searchParams.get('venue_id')
      return send(await listRecipes(a.db, a.organizationId, cfg, venue), 'recipes')
    },
    async POST(request: NextRequest) {
      const a = await auth()
      if ('error' in a) return a.error
      const denied = await denyReadOnlyAdvisor(a.db, { id: a.userId }, a.organizationId)
      if (denied) return denied
      let body: any
      try {
        body = await request.json()
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
      }
      return send(await createRecipe(a.db, a.organizationId, a.userId, cfg, body), 'recipe', 201)
    },
  }
}

export function recipeDuplicateHandler(cfg: RecipeKindConfig) {
  return {
    async POST(_request: NextRequest, { params }: { params: { id: string } }) {
      const a = await auth()
      if ('error' in a) return a.error
      const denied = await denyReadOnlyAdvisor(a.db, { id: a.userId }, a.organizationId)
      if (denied) return denied
      return send(await duplicateRecipe(a.db, a.organizationId, a.userId, cfg, params.id), 'recipe', 201)
    },
  }
}

export function recipeItemHandlers(cfg: RecipeKindConfig) {
  return {
    async GET(_request: NextRequest, { params }: { params: { id: string } }) {
      const a = await auth()
      if ('error' in a) return a.error
      return send(await getRecipe(a.db, a.organizationId, cfg, params.id), 'recipe')
    },
    async PATCH(request: NextRequest, { params }: { params: { id: string } }) {
      const a = await auth()
      if ('error' in a) return a.error
      const denied = await denyReadOnlyAdvisor(a.db, { id: a.userId }, a.organizationId)
      if (denied) return denied
      let body: any
      try {
        body = await request.json()
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
      }
      const r = await updateRecipe(a.db, a.organizationId, cfg, params.id, body)
      return r.ok ? NextResponse.json(r.data) : NextResponse.json({ error: r.error }, { status: r.status })
    },
    async DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
      const a = await auth()
      if ('error' in a) return a.error
      const denied = await denyReadOnlyAdvisor(a.db, { id: a.userId }, a.organizationId)
      if (denied) return denied
      const r = await deleteRecipe(a.db, a.organizationId, cfg, params.id)
      return r.ok ? NextResponse.json(r.data) : NextResponse.json({ error: r.error }, { status: r.status })
    },
  }
}
